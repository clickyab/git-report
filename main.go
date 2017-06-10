package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"text/template"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"clickyab.com/git-report/assert"
	"clickyab.com/git-report/crypto"
	git "gopkg.in/src-d/go-git.v4"
)

func submodules(repo *git.Repository) []string {
	result := make([]string, 0)
	c, _ := repo.Config()
	for _, s := range c.Submodules {
		result = append(result, s.Name)
	}
	return result
}

func submodule(repo *git.Repository, name string) *git.Repository {

	var result *git.Repository
	w, _ := repo.Worktree()
	r, e := w.Submodule(name)

	if e == git.ErrSubmoduleNotFound {
		log.Fatalf("submodule with name %s not found, please try -ls", name)
	}

	t, _ := r.Repository()
	result = t
	return result

}

var key [32]byte

func keyer() {
	s := sha256.New()
	pp := s.Sum([]byte(os.Getenv("SALT")))
	copy(key[:], pp[:32])
}

func encrypt(u user) string {
	m, e := json.Marshal(u)
	assert.Nil(e)

	x, er := crypto.Encrypt(m, &key)
	assert.Nil(er)
	return base64.StdEncoding.EncodeToString(x)
}

func decrypt(s string) user {
	r, e := base64.StdEncoding.DecodeString(s)
	assert.Nil(e)
	x, er := crypto.Decrypt([]byte(r), &key)
	assert.Nil(er)
	u := &user{}
	e = json.Unmarshal(x, u)
	assert.Nil(e)
	return *u
}
func init() {
	keyer()
}

func main() {
	http.HandleFunc("/ws", socketHandler)

	http.HandleFunc("/data", func(r http.ResponseWriter, w *http.Request) {
		a := w.Header.Get("x-auth")

		if a == "" {
			r.WriteHeader(http.StatusForbidden)
			return
		}
		if w.Method != "GET" {
			r.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		u := decrypt(a)
		z := getByUser(u)
		if len(z) == 0 {
			r.WriteHeader(http.StatusNotFound)
			return
		}
		res, e := json.Marshal(z)
		if e != nil {
			r.WriteHeader(http.StatusInternalServerError)
			return
		}
		r.Header().Set("Content-Type", "application/json")
		r.WriteHeader(http.StatusOK)
		r.Write(res)

	})

	http.HandleFunc("/login", func(r http.ResponseWriter, q *http.Request) {
		if q.Method != "POST" {
			r.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		dec := json.NewDecoder(q.Body)
		u := &user{}

		e := dec.Decode(u)

		if e != nil {
			r.WriteHeader(http.StatusBadRequest)
			return
		}

		d := encrypt(*u)
		r.Header().Set("Content-Type", "text/text")
		r.WriteHeader(http.StatusOK)
		r.Write([]byte(d))

	})

	http.HandleFunc("/", func(r http.ResponseWriter, w *http.Request) {

		m, e := json.Marshal(repositories)
		assert.Nil(e)
		fmt.Println(string(m))
		b := bytes.Buffer{}
		template.JSEscape(&b, m)

		r.Header().Set("Content-Type", "text/html")
		r.WriteHeader(http.StatusOK)
		r.Write(templateBuilder(b.Bytes()))
	})
	http.ListenAndServe(fmt.Sprintf(":%d", port), nil)

}

func getByUser(u user) []repository {
	z := make([]repository, 0)
	for _, v := range repositories {
		for _, a := range v.Users {
			if a.ID == u.ID && a.Pass == u.Pass {
				z = append(z, v)
				break
			}
		}
	}
	return z
}

type templateInfo struct {
	Date  time.Time
	Data  string
	Js    string
	Style string
}

func templateBuilder(data []byte) []byte {
	master, _ := Asset("resource/template/report.html")
	app, _ := Asset("resource/template/app.js")
	style, _ := Asset("resource/template/style.css")

	t := templateInfo{
		time.Now(),
		string(data),
		string(app),
		string(style),
	}

	result, e := template.New("report").Parse(string(master))

	if e != nil {
		fmt.Println(e)
	}

	buf := bytes.Buffer{}

	result.Execute(&buf, t)
	return buf.Bytes()

}

// CopyFile copies the contents of the file named src to the file named
// by dst. The file will be created if it does not already exist. If the
// destination file exists, all it's contents will be replaced by the contents
// of the source file. The file mode will be copied from the source and
// the copied data is synced/flushed to stable storage.
func copyFile(src, dst string) (err error) {
	in, err := os.Open(src)
	if err != nil {
		return
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return
	}
	defer func() {
		if e := out.Close(); e != nil {
			err = e
		}
	}()

	_, err = io.Copy(out, in)
	if err != nil {
		return
	}

	err = out.Sync()
	if err != nil {
		return
	}

	si, err := os.Stat(src)
	if err != nil {
		return
	}
	err = os.Chmod(dst, si.Mode())
	if err != nil {
		return
	}

	return
}

// CopyDir recursively copies a directory tree, attempting to preserve permissions.
// Source directory must exist, destination directory must *not* exist.
// Symlinks are ignored and skipped.
func copyDir(src string, dst string) (err error) {
	src = filepath.Clean(src)
	dst = filepath.Clean(dst)

	si, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !si.IsDir() {
		return fmt.Errorf("source is not a directory")
	}

	_, err = os.Stat(dst)
	if err != nil && !os.IsNotExist(err) {
		return
	}
	if err == nil {
		return fmt.Errorf("destination already exists")
	}

	err = os.MkdirAll(dst, si.Mode())
	if err != nil {
		return
	}

	entries, err := ioutil.ReadDir(src)
	if err != nil {
		return
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			err = copyDir(srcPath, dstPath)
			if err != nil {
				return
			}
		} else {
			// Skip symlinks.
			if entry.Mode()&os.ModeSymlink != 0 {
				continue
			}

			err = copyFile(srcPath, dstPath)
			if err != nil {
				return
			}
		}
	}

	return
}
