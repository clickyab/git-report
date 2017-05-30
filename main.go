package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"text/template"
	"time"

	git "gopkg.in/src-d/go-git.v4"
)

var (
	submod          = flag.String("s", "", "Export submodule")
	submodulesList  = flag.Bool("ls", false, "list of submodules")
	input           = flag.String("i", ".", "Refer to git repository in your drive")
	limit           = flag.Int("l", 100, "Specify how many log should be exported")
	redmindEndpoint = flag.String("re", "", `Redmine host (ex: http://redmine.example.com)`)
	redmindAPIKey   = flag.String("ra", "", `Redmine APIKey. you need to enable REST API. you can find more information about how
	     to enable it on http://www.redmine.org/projects/redmine/wiki/Rest_api#Authentication`)
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

func main() {

	flag.Parse()

	if *limit < 1 {
		log.Fatal()
	}

	repo, _ := git.PlainOpen(getPath())
	if *submodulesList {
		for _, s := range submodules(repo) {
			fmt.Println(s)
		}
		os.Exit(0)
	}
	if *submod != "" {
		copySubmodules()
		repo = submodule(repo, *submod)
	}

	c := commits(repo)
	red := make([]trackerData, 0)
	r, e := redmineIssue()
	if e == nil {
		red = r
	}

	authors := make([]author, 0)
	for _, a := range authorList {
		authors = append(authors, a)
	}
	report := report{
		time.Now(),
		len(c),
		authors,
		c,
		red,
	}

	j, e := json.Marshal(report)

	fError(e, "way!!!!")
	b := bytes.Buffer{}
	template.JSEscape(&b, j)
	fmt.Println(string(templateBuilder(b.Bytes())))
}

type templateInfo struct {
	Date  time.Time
	Data  string
	Js    string
	Style string
}

func templateBuilder(data []byte) []byte {
	master, _ := Asset("src/cmd/reporter/resource/template/report.html")
	app, _ := Asset("src/cmd/reporter/resource/template/app.js")
	style, _ := Asset("src/cmd/reporter/resource/template/style.css")

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

type report struct {
	CreationTime time.Time     `json:"time"`
	Count        int           `json:"count"`
	Authors      []author      `json:"authors"`
	Commits      []commitInfo  `json:"commits"`
	Redmine      []trackerData `json:"redmine"`
}

func copySubmodules() {
	path := getPath() + "/.git/"
	copyDir(path+"modules", path+"module")
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
