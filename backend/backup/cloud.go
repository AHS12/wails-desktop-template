package backup

// Backing up to the cloud, and restoring from it. Cloud backup lives in the files
// named cloud*.go; removing them and their frontend leaves backups to a file and a folder.
//
// The bucket holds the same layout as a backup file, loose rather than zipped,
// so a backup only uploads what changed:
//
//	<folder>/backup.json             each file's size, checksum and time saved
//	<folder>/documents/<id>.json     the document, byte for byte, and its picture
//	<folder>/removed/<id>.json       a mark that a computer removed the document
//	<folder>/extras.json
//
// The objects are the truth and backup.json a shortcut: each document also
// carries its checksum and time saved as metadata, so backup.json can be
// rebuilt from a listing, and two computers writing it at once lose nothing.
// Nothing is ever deleted from the bucket.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"wails-desktop-template/backend/documents"
	"wails-desktop-template/backend/fsutil"

	"wails-desktop-template/appconfig"
)

const (
	cloudRemovedFolder = "removed/"
	backupStateName    = "backup-state.json"

	metaSHA256  = "sha256"
	metaSavedAt = "saved-at"
)

// CloudSummary says what a backup to the cloud did.
type CloudSummary struct {
	// Documents is how many documents the backup holds from this computer.
	Documents int `json:"documents"`
	// Uploaded is how many files went up this time.
	Uploaded int `json:"uploaded"`
	// ChangedElsewhere is how many documents were left as they are in the
	// bucket, because another computer saved them later.
	ChangedElsewhere int `json:"changedElsewhere"`
	// Removed is how many documents were marked as removed on this computer.
	Removed int `json:"removed"`
}

// backupState is what this computer last uploaded, so a backup knows what
// changed without asking the bucket about every file. It belongs to one
// target: pointing cloud backup elsewhere starts it afresh.
type backupState struct {
	Target string            `json:"target"`
	Files  map[string]string `json:"files"`
	Extras string            `json:"extras"`
}

// CheckCloudBackup checks the target and the saved keys end to end: the
// bucket is there, a small file can be written and read back, and the folder
// can be listed. The file is left, not deleted, so keys without delete
// permission pass; it's the same small file each time.
func (s *Service) CheckCloudBackup(target CloudTarget) error {
	store, err := s.cloudStore(target)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*requestTimeout)
	defer cancel()

	if err := store.ping(ctx); err != nil {
		return err
	}

	probe := []byte(appconfig.Current().Name + " can read and write here")
	if err := store.put(ctx, cloudKey(target, cloudProbeName()), probe, nil); err != nil {
		return err
	}

	read, err := store.get(ctx, cloudKey(target, cloudProbeName()))
	if err != nil {
		return err
	}

	if string(read) != string(probe) {
		return fmt.Errorf("%w: what was read back isn't what was written", errCloudUnreachable)
	}

	_, err = store.list(ctx, cloudKey(target, ""))

	return err
}

// BackUpToCloud uploads every file of the library that changed
// since this computer last did, and the extras if they changed. A document that
// this computer uploaded before and no longer has is marked as removed, never
// deleted. A document another computer saved later is left as it is.
func (s *Service) BackUpToCloud(target CloudTarget, extras []byte, appVersion string) (CloudSummary, error) {
	backupStop.Store(false)

	store, err := s.cloudStore(target)
	if err != nil {
		return CloudSummary{}, err
	}

	dir, err := s.library.LibraryFolder()
	if err != nil {
		return CloudSummary{}, err
	}

	local, err := localBackupFiles(dir)
	if err != nil {
		return CloudSummary{}, err
	}

	state := s.loadBackupState(target)
	ctx := context.Background()

	remote, err := readCloudManifest(ctx, store, target)
	if err != nil {
		return CloudSummary{}, err
	}

	entries := manifestByPath(remote)
	summary := CloudSummary{}
	now := time.Now().UTC().Format(time.RFC3339)

	for index, file := range local {
		if backupStop.Load() {
			s.saveBackupState(state)
			return summary, errBackupStopped
		}

		if isTopLevelDocument(file.Path) {
			summary.Documents++
		}

		there, known := entries[file.Path]

		switch {
		case known && there.SHA256 == file.SHA256 && there.RemovedAt == "":
			state.Files[file.Path] = file.SHA256
		case known && there.SHA256 != file.SHA256 && there.SHA256 != state.Files[file.Path] && there.SavedAt > file.SavedAt:
			// Another computer saved this later: theirs stays, and a restore can bring it in.
			summary.ChangedElsewhere++
		default:
			contents, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(file.Path)))
			if err != nil {
				return summary, fmt.Errorf("cannot back up %q: %w", file.Path, err)
			}

			meta := map[string]string{metaSHA256: file.SHA256, metaSavedAt: file.SavedAt}
			if err := store.put(ctx, cloudKey(target, backupDocumentsFolder+file.Path), contents, meta); err != nil {
				s.saveBackupState(state)
				return summary, err
			}

			entries[file.Path] = file
			state.Files[file.Path] = file.SHA256
			summary.Uploaded++
		}

		s.emitBackupProgress(index+1, len(local))
	}

	present := make(map[string]bool, len(local))
	for _, file := range local {
		present[file.Path] = true
	}

	for uploaded := range state.Files {
		if present[uploaded] {
			continue
		}

		delete(state.Files, uploaded)

		entry, known := entries[uploaded]
		if !isTopLevelDocument(uploaded) || !known || entry.RemovedAt != "" {
			continue
		}

		id := strings.TrimSuffix(uploaded, documents.JSONSuffix)
		mark, _ := json.Marshal(map[string]string{"removedAt": now})

		if err := store.put(ctx, cloudKey(target, cloudRemovedFolder+id+documents.JSONSuffix), mark, nil); err != nil {
			return summary, err
		}

		entry.RemovedAt = now
		entries[uploaded] = entry
		summary.Removed++
	}

	extrasChanged := false

	if len(extras) > 0 {
		sum := sha256.Sum256(extras)
		if hex.EncodeToString(sum[:]) != state.Extras {
			if err := store.put(ctx, cloudKey(target, backupExtrasName), extras, nil); err != nil {
				return summary, err
			}

			state.Extras = hex.EncodeToString(sum[:])
			extrasChanged = true
		}
	}

	// Nothing new, and the bucket already has its list: nothing to write.
	if summary.Uploaded == 0 && summary.Removed == 0 && !extrasChanged && len(remote.Files) > 0 && remote.App != "" {
		s.saveBackupState(state)
		return summary, nil
	}

	// Read again just before writing, so a computer that backed up meanwhile
	// keeps its entries: for each file, the later save wins.
	if fresh, err := readCloudManifest(ctx, store, target); err == nil {
		for _, entry := range fresh.Files {
			ours, known := entries[entry.Path]
			if !known || entry.SavedAt > ours.SavedAt {
				entries[entry.Path] = entry
			}
		}
	}

	if err := writeCloudManifest(ctx, store, target, entries, appVersion); err != nil {
		return summary, err
	}

	s.saveBackupState(state)

	return summary, nil
}

// OpenCloudBackup downloads the cloud backup into the holding folder and says
// what's in it, as OpenBackupFile does for a file. Documents removed on a computer
// come down too, marked "removed" when they aren't here, so they can still be
// brought back.
func (s *Service) OpenCloudBackup(target CloudTarget) (HeldBackup, error) {
	backupStop.Store(false)

	store, err := s.cloudStore(target)
	if err != nil {
		return HeldBackup{}, err
	}

	ctx := context.Background()

	manifest, err := readCloudManifest(ctx, store, target)
	if err != nil {
		return HeldBackup{}, err
	}

	holding, err := s.freshHoldingDir()
	if err != nil {
		return HeldBackup{}, err
	}

	removed := map[string]bool{}

	for index, entry := range manifest.Files {
		if backupStop.Load() {
			s.ClearHolding()
			return HeldBackup{}, errBackupStopped
		}

		relative, err := backupEntryPath(backupDocumentsFolder + entry.Path)
		if err != nil {
			s.ClearHolding()
			return HeldBackup{}, err
		}

		contents, err := store.get(ctx, cloudKey(target, backupDocumentsFolder+relative))
		if errors.Is(err, errNoSuchObject) {
			continue
		}

		if err != nil {
			s.ClearHolding()
			return HeldBackup{}, err
		}

		at, err := time.Parse(time.RFC3339, entry.SavedAt)
		if err != nil {
			at = time.Now()
		}

		heldPath := filepath.Join(holding, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(heldPath), 0o755); err != nil {
			return HeldBackup{}, err
		}

		if err := writeFileKeepingTime(heldPath, contents, at); err != nil {
			s.ClearHolding()
			return HeldBackup{}, err
		}

		if entry.RemovedAt != "" && isTopLevelDocument(relative) {
			removed[strings.TrimSuffix(relative, documents.JSONSuffix)] = true
		}

		s.emitBackupProgress(index+1, len(manifest.Files))
	}

	held := HeldBackup{App: manifest.App, MadeAt: manifest.MadeAt}

	if extras, err := store.get(ctx, cloudKey(target, backupExtrasName)); err == nil {
		held.Extras = string(extras)
	} else if !errors.Is(err, errNoSuchObject) {
		s.ClearHolding()
		return HeldBackup{}, err
	}

	held.Documents, err = s.heldDocuments(holding)
	if err != nil {
		return HeldBackup{}, err
	}

	for index, document := range held.Documents {
		if removed[document.ID] && document.Status == "new" {
			held.Documents[index].Status = "removed"
		}
	}

	return held, nil
}

// CloudDocumentStatus says whether one document is in the cloud backup as it is now:
// "backed-up", "changed" since this computer last backed it up, or "not-yet".
// It reads only what this computer remembers uploading and the document itself, so
// it's quick enough for the library page and needs no connection.
func (s *Service) CloudDocumentStatus(target CloudTarget, id string) (string, error) {
	if err := fsutil.CheckID(id); err != nil {
		return "", err
	}

	folder, err := s.library.LibraryFolder()
	if err != nil {
		return "", err
	}

	path := filepath.Join(folder, id+documents.JSONSuffix)

	uploaded, known := s.loadBackupState(target).Files[id+documents.JSONSuffix]
	if !known {
		return "not-yet", nil
	}

	contents, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	sum := sha256.Sum256(contents)
	if hex.EncodeToString(sum[:]) != uploaded {
		return "changed", nil
	}

	return "backed-up", nil
}

func (s *Service) cloudStore(target CloudTarget) (objectStore, error) {
	keys, err := s.loadKeys()
	if err != nil {
		return nil, err
	}

	if s.cloudStoreFor != nil {
		return s.cloudStoreFor(target, keys)
	}

	return newS3Store(target, keys)
}

// cloudKey is name inside the target's folder in the bucket.
func cloudKey(target CloudTarget, name string) string {
	folder := strings.Trim(target.Folder, "/ ")
	if folder == "" {
		return name
	}

	return folder + "/" + name
}

func isTopLevelDocument(relative string) bool {
	return !strings.Contains(relative, "/") && strings.HasSuffix(relative, documents.JSONSuffix)
}

// localBackupFiles is every file a backup holds, with its checksum and time.
func localBackupFiles(dir string) ([]backupFile, error) {
	paths, err := backupFiles(dir)
	if err != nil {
		return nil, err
	}

	files := make([]backupFile, 0, len(paths))

	for _, relative := range paths {
		full := filepath.Join(dir, filepath.FromSlash(relative))

		info, err := os.Stat(full)
		if err != nil {
			return nil, fmt.Errorf("cannot read %q: %w", relative, err)
		}

		contents, err := os.ReadFile(full)
		if err != nil {
			return nil, fmt.Errorf("cannot read %q: %w", relative, err)
		}

		sum := sha256.Sum256(contents)
		files = append(files, backupFile{
			Path:    relative,
			Size:    info.Size(),
			SHA256:  hex.EncodeToString(sum[:]),
			SavedAt: info.ModTime().UTC().Format(time.RFC3339),
		})
	}

	return files, nil
}

// readCloudManifest reads backup.json, or rebuilds it from the objects when
// it's missing or damaged. An empty bucket folder gives an empty manifest.
func readCloudManifest(ctx context.Context, store objectStore, target CloudTarget) (backupManifest, error) {
	contents, err := store.get(ctx, cloudKey(target, backupManifestName))
	if err == nil {
		var manifest backupManifest
		if json.Unmarshal(contents, &manifest) == nil && manifest.Format >= 1 {
			if manifest.Format > backupFormat {
				return backupManifest{}, errNewerBackup
			}

			return manifest, nil
		}
	} else if !errors.Is(err, errNoSuchObject) {
		return backupManifest{}, err
	}

	return rebuildCloudManifest(ctx, store, target)
}

// rebuildCloudManifest makes backup.json again from a listing and each document's
// metadata, and the removed marks.
func rebuildCloudManifest(ctx context.Context, store objectStore, target CloudTarget) (backupManifest, error) {
	manifest := backupManifest{Format: backupFormat, Files: []backupFile{}}

	objects, err := store.list(ctx, cloudKey(target, backupDocumentsFolder))
	if err != nil {
		return manifest, err
	}

	removedAt := map[string]string{}

	marks, err := store.list(ctx, cloudKey(target, cloudRemovedFolder))
	if err != nil {
		return manifest, err
	}

	for _, mark := range marks {
		contents, err := store.get(ctx, mark.Key)
		if err != nil {
			continue
		}

		var body struct {
			RemovedAt string `json:"removedAt"`
		}

		if json.Unmarshal(contents, &body) == nil {
			removedAt[strings.TrimSuffix(path.Base(mark.Key), documents.JSONSuffix)] = body.RemovedAt
		}
	}

	for _, object := range objects {
		relative := strings.TrimPrefix(object.Key, cloudKey(target, backupDocumentsFolder))

		meta, err := store.head(ctx, object.Key)
		if err != nil {
			return manifest, err
		}

		entry := backupFile{Path: relative, Size: object.Size, SHA256: meta[metaSHA256], SavedAt: meta[metaSavedAt]}

		// A document saved again after it was marked removed is back.
		if mark, marked := removedAt[strings.TrimSuffix(relative, documents.JSONSuffix)]; marked && isTopLevelDocument(relative) && mark > entry.SavedAt {
			entry.RemovedAt = mark
		}

		manifest.Files = append(manifest.Files, entry)
	}

	return manifest, nil
}

func writeCloudManifest(ctx context.Context, store objectStore, target CloudTarget, entries map[string]backupFile, appVersion string) error {
	manifest := backupManifest{Format: backupFormat, App: appVersion, MadeAt: time.Now().UTC().Format(time.RFC3339), Files: []backupFile{}}

	for _, entry := range entries {
		manifest.Files = append(manifest.Files, entry)
	}

	slices.SortFunc(manifest.Files, func(left, right backupFile) int { return strings.Compare(left.Path, right.Path) })

	contents, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}

	return store.put(ctx, cloudKey(target, backupManifestName), contents, nil)
}

func manifestByPath(manifest backupManifest) map[string]backupFile {
	entries := make(map[string]backupFile, len(manifest.Files))
	for _, entry := range manifest.Files {
		entries[entry.Path] = entry
	}

	return entries
}

// targetName is what backupState belongs to: the same storage, bucket and folder.
func targetName(target CloudTarget) string {
	return strings.Join([]string{target.Service, target.Endpoint, target.Bucket, strings.Trim(target.Folder, "/ ")}, "|")
}

func (s *Service) backupStatePath() (string, error) {
	data, err := s.shell.DataFolder()
	if err != nil {
		return "", err
	}

	return filepath.Join(data, backupStateName), nil
}

// loadBackupState reads what this computer last uploaded to target. Anything
// missing, damaged or for another target starts afresh, which only costs
// comparing checksums with the bucket's list.
func (s *Service) loadBackupState(target CloudTarget) backupState {
	fresh := backupState{Target: targetName(target), Files: map[string]string{}}

	statePath, err := s.backupStatePath()
	if err != nil {
		return fresh
	}

	contents, err := os.ReadFile(statePath)
	if err != nil {
		return fresh
	}

	var state backupState
	if json.Unmarshal(contents, &state) != nil || state.Target != fresh.Target || state.Files == nil {
		return fresh
	}

	return state
}

func (s *Service) saveBackupState(state backupState) {
	statePath, err := s.backupStatePath()
	if err != nil {
		return
	}

	contents, err := json.Marshal(state)
	if err != nil {
		return
	}

	if err := os.MkdirAll(filepath.Dir(statePath), 0o755); err == nil {
		_ = fsutil.WriteAtomic(statePath, contents)
	}
}

// cloudProbeName is the file a setup check writes and reads back, and then removes.
func cloudProbeName() string {
	return "." + appconfig.Current().ID + "-check"
}
