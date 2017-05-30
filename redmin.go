package main

import (
	"github.com/fzerorubigd/go-redmine"
)

type trackerData struct {
	ID          int    `json:"id"`
	Status      string `json:"status"`
	Subject     string `json:"subject"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
	Author      string `json:"author"`
}

func redmineIssue() ([]trackerData, error) {

	redClient := redmine.NewClient(*redmindEndpoint, *redmindAPIKey)
	s, e := redClient.FilterIssues(redmine.IssueFilter{"limit", "999"}, redmine.IssueFilter{"status_id", "*"})
	if e != nil {
		return nil, e
	}

	result := make([]trackerData, 0)
	for _, k := range s {
		result = append(result, trackerData{
			k.Id,
			k.Status.Name,
			k.Subject,
			k.Description,
			k.Priority.Name,
			k.Author.Name,
		})
	}

	return result, nil
}
