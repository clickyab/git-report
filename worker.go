package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"clickyab.com/git-report/assert"
	git "gopkg.in/src-d/go-git.v4"
)

type config struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Github  string `json:"github"`
	Redmine string `json:"redmine"`
	Users   []struct {
		ID   string `json:"id"`
		Pass string `json:"pass"`
	} `json:"users"`
	Path string `json:"_"`
}

var (
	path         = ""
	port         = 0
	configName   = ".report.conf"
	repositories = make([]repository, 0)
)

func loadConfig() {
	path = os.Getenv("REPORTPATH")
	if path == "" {
		panic("please set REPORTPATH in your environment")
	}
	var e error
	port, e = strconv.Atoi(os.Getenv("PORT"))
	assert.Nil(e)
	if port == 0 {
		panic("please add a valid PORT in your environment ")
	}
	if c := os.Getenv("RCONFIG"); c != "" {
		configName = c
	}

}

func init() {
	loadConfig()
}

var configs = make([]*config, 0)

func find(path string) []*config {
	var configs = make([]*config, 0)
	filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if !strings.HasSuffix(path, configName) {
			return nil
		}

		b, e := ioutil.ReadFile(path)
		assert.Nil(e)
		c := &config{}
		e = json.Unmarshal(b, c)
		assert.Nil(e)
		c.Path = strings.Replace(path, configName, "", -1)
		fmt.Println(c.Name)
		configs = append(configs, c)
		return nil
	})

	if len(configs) < 1 {
		fmt.Println(fmt.Sprintf(`Didn't find any config file in "%s"`, path))
		os.Exit(1)
	}
	return configs
}

func filter(id, pass string) []*config {
	r := make([]*config, 0)
	for _, c := range configs {
		for _, u := range c.Users {
			if u.ID == id && u.Pass == pass {
				r = append(r, c)
			}
		}
	}
	return r
}

func getRepo(c config) repository {
	r, e := git.PlainOpen(c.Path)
	assert.Nil(e)
	cs := commits(r)
	return repository{
		Name:    c.Name,
		Commits: cs,
		URL:     c.URL,
		Github:  c.Github,
		Redmine: c.Redmine,
	}
}

type user struct {
	ID   string `json:"id"`
	Pass string `json:"pass"`
}
