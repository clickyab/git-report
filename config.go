package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

var (
	tagPattern = regexp.MustCompile(`(ref|fix)?\s*#([0-9]+)`)
)

func getPath() string {
	path, _ := filepath.Abs(*input)
	res, err := os.Stat(path)
	if err != nil || !res.IsDir() {
		fError(err, "There is o directory at %s. use -h for more information", path)
	}
	return path
}

func fError(err interface{}, message ...interface{}) {
	if err != nil {
		fmt.Println(fmt.Sprintf(message[0].(string), message[1:]...))
		os.Exit(1)
	}
}
