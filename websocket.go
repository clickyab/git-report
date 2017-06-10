package main

import (
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"clickyab.com/git-report/assert"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024, CheckOrigin: func(r *http.Request) bool { return true }}

var connections = make(map[string]connection)
var locker = sync.Mutex{}

func socketHandler(r http.ResponseWriter, w *http.Request) {
	c, e := upgrader.Upgrade(r, w, nil)
	assert.Nil(e)
	locker.Lock()
	defer locker.Unlock()
	var id string
	queue := make(chan response)
	for {
		r := EncodeToString(6)
		if _, ok := connections[r]; !ok {
			id = r
			connections[id] = connection{
				messageQueue: queue,
				conn:         c,
			}
			time.Sleep(50 * time.Microsecond)
			c.WriteJSON(response{
				Kind: "id",
				Data: id,
			})

			break
		}
	}

	go func() {
		ch := reader(id)
		//unauthorized := time.After(2 * time.Minute)
		//idl := time.After(60 * time.Minute)
		for {
			select {
			case r := <-ch:
				if r == 1 {
					//unauthorized = nil
					//idl = time.After(10 * time.Minute)
				}
				if r == 2 {
					//idl = time.After(10 * time.Minute)
				}
				if r == 0 {
					clean(id)
					break
				}
				//case <-unauthorized:
				//	clean(id)
				//	break
				//case <-idl:
				//	clean(id)
				//	break
			}
		}
	}()

	go func() {
		for a := range queue {
			c.WriteJSON(a)
		}
	}()
}

func clean(id string) {
	locker.Lock()
	defer locker.Unlock()
	c := connections[id]
	c.conn.Close()
	delete(connections, id)

}

type connection struct {
	conn         *websocket.Conn
	messageQueue chan response
}

func reader(id string) <-chan int {
	c := connections[id]
	ch := make(chan int)
	go func() {
		for {
			messageType, data, e := c.conn.ReadMessage()

			if e != nil || messageType == websocket.CloseMessage {

				ch <- 0
				break
			}
			if messageType == websocket.PingMessage {
				c.conn.WriteMessage(websocket.PongMessage, nil)
			}
			if messageType == websocket.TextMessage {
				m := &request{}
				ej := json.Unmarshal(data, m)
				if ej != nil {
					continue
				}
				switch m.Kind {
				case "toke":

				case "login":
					x := &loginModel{}
					e = json.Unmarshal(m.Data, x)
					assert.Nil(e)

					configs = find(path)
					reps := make([]repository, 0)
					for _, r := range filter(x.ID, x.Pass) {
						reps = append(reps, getRepo(*r))
					}
					y := response{
						Kind: "repositories",
						Data: reps,
					}
					c.messageQueue <- y
					ch <- 1
					if len(x.ConnectionID) == 6 {
						locker.Lock()
						rm := connections[x.ConnectionID]
						rm.messageQueue <- y
						locker.Unlock()
					}
				case "remote":
					continue
				}
			}
		}
	}()

	return ch
}

type loginModel struct {
	ID           string `json:"id"`
	Pass         string `json:"pass"`
	ConnectionID string `json:"cid"`
}

type response struct {
	Kind string      `json:"kind"`
	Data interface{} `json:"data"`
}

type request struct {
	Kind string          `json:"kind"`
	Data json.RawMessage `json:"data"`
}

func EncodeToString(max int) string {
	b := make([]byte, max)
	n, err := io.ReadAtLeast(rand.Reader, b, max)
	if n != max {
		panic(err)
	}
	for i := 0; i < len(b); i++ {
		b[i] = table[int(b[i])%len(table)]
	}
	return string(b)
}

var table = [...]byte{'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'}
