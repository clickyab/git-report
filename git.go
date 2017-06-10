package main

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

const (
	signPattern = "(?i) -----END PGP SIGNATURE-----"
)

var (
	signExp    = regexp.MustCompile(signPattern)
	tagPattern = regexp.MustCompile(`(ref|fix)?\s*#([0-9]+)`)
)

type repository struct {
	Name    string       `json:"name"`
	URL     string       `json:"url"`
	Github  string       `json:"github"`
	Redmine string       `json:"redmine"`
	Commits []commitInfo `json:"commits"`
	Users   []user       `json:"users"`
}
type commitInfo struct {
	Date    time.Time `json:"time"`
	Hash    string    `json:"hash"`
	Message string    `json:"request"`
	Tags    []tag     `json:"tags"`
	Author  author    `json:"author"`
}

type author struct {
	Avatar string `json:"avatar"`
	Name   string `json:"name"`
	Email  string `json:"email"`
}
type tag struct {
	Code int    `json:"code"`
	Type string `json:"type"`
}

func commits(repo *git.Repository) []commitInfo {
	head, _ := repo.Head()
	commit, _ := repo.CommitObject(head.Hash())

	h := object.NewCommitPreIterator(commit)
	defer h.Close()
	commits := make([]commitInfo, 0)
	for i := 0; ; i++ {
		c, err := h.Next()
		if err != nil {
			break
		}

		commits = append(commits, commitInfo{
			c.Author.When,
			c.Hash.String(),
			pureMessage(c.Message),
			tagFinder(c.Message),
			author{
				Avatar: emailHash(c.Author.Email),
				Email:  c.Author.Email,
				Name:   c.Author.Name,
			},
		})
	}

	return commits
}

func pureMessage(m string) string {
	if signExp.Match([]byte(m)) {
		i := signExp.FindStringIndex(m)
		m = m[i[0]+len(signPattern)+2:]
	}
	return m
}

func emailHash(e string) string {
	h := md5.New()
	io.WriteString(h, e)
	return hex.EncodeToString(h.Sum(nil))
}

func tagFinder(m string) []tag {
	m = strings.ToLower(m)

	rawTags := tagPattern.FindAllStringSubmatch(m, -1)
	result := make([]tag, 0)
	if len(rawTags) > 0 {
		for _, c := range rawTags {
			code, _ := strconv.Atoi(c[2])
			result = append(result, tag{code, c[1]})
		}
	}
	return result
}
