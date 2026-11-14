package backup

// The keys for cloud backup live in the system's keychain, through the secrets
// package: never in the settings file, which the interface also copies into the
// browser's storage, and never handed back to the interface once typed. Only the
// access key, which isn't secret on its own, is ever shown again.

import (
	"encoding/json"
	"errors"
	"fmt"

	"wails-desktop-template/backend/secrets"
)

// cloudKeysName is the keys' entry in the keychain.
const cloudKeysName = "cloud-backup"

// cloudKeys are the two keys a storage service gives out.
type cloudKeys struct {
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
}

// CloudKeysInfo says whether keys are saved, and which, without the secret.
type CloudKeysInfo struct {
	Saved     bool   `json:"saved"`
	AccessKey string `json:"accessKey"`
}

func (s *Service) loadKeys() (cloudKeys, error) {
	text, err := s.secrets.Get(cloudKeysName)
	if errors.Is(err, secrets.ErrNotFound) {
		return cloudKeys{}, errCloudNoKeys
	}

	if err != nil {
		return cloudKeys{}, err
	}

	var keys cloudKeys
	if err := json.Unmarshal([]byte(text), &keys); err != nil || keys.AccessKey == "" || keys.SecretKey == "" {
		return cloudKeys{}, errCloudNoKeys
	}

	return keys, nil
}

// SetCloudKeys saves the keys for cloud backup. An empty secret keeps the one
// already saved, so the access key can change without typing the secret again.
func (s *Service) SetCloudKeys(accessKey string, secretKey string) error {
	if accessKey == "" {
		return fmt.Errorf("%w: the access key is empty", errCloudNoKeys)
	}

	if secretKey == "" {
		saved, err := s.loadKeys()
		if err != nil {
			return err
		}

		secretKey = saved.SecretKey
	}

	text, err := json.Marshal(cloudKeys{AccessKey: accessKey, SecretKey: secretKey})
	if err != nil {
		return err
	}

	return s.secrets.Set(cloudKeysName, string(text))
}

// CloudKeys says whether keys are saved, and the access key, never the secret.
func (s *Service) CloudKeys() CloudKeysInfo {
	keys, err := s.loadKeys()
	if err != nil {
		return CloudKeysInfo{}
	}

	return CloudKeysInfo{Saved: true, AccessKey: keys.AccessKey}
}

// ForgetCloudKeys removes the keys from the keychain, as turning cloud backup
// off does.
func (s *Service) ForgetCloudKeys() error {
	return s.secrets.Delete(cloudKeysName)
}
