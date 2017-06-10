interface repository {
    name: string;
    url: string;
    github: string;
    redmine: string;
    commits: commit_info[];
}

interface commit_info {
    time: Date;
    hash: string;
    request: string;
    tags: tag[];
    author: author;
}


interface author {
    avatar: string;
    name: string;
    email: string;
}

interface tag {
    code: number;
    type: string;
}


const commitTpl = `
<div class="commit">
    <div class="timeline">
        <div class="icon icon-0">
            <div>[[acronim]]</div>
            <img src="https://www.gravatar.com/avatar/[[avatar]]" 
            alt="[[name]], [[email]]">
        </div>
    </div>
    <div class="info">
        <div class="details git">
            <h2>[[message]]</h2>
            <a href="https://github.com/[[repository]]/commit/[[hash]]">[[hash]]</a>
            <div class="tags">
                [[tags]]
            </div>
            <div class="date">[[date]]</div>
        </div>
    </div>
</div>
`;
const tagTpl = ` <a href="https://[[redmine]]/issues/[[code]]" >#[[code]]</a>`;

const monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
];


class report {

    repositories: repository[];
    tabs: HTMLDivElement[] = [];
    current: repository;

    constructor(d: repository[]) {
        this.repositories = d;
        let header = this.divElem("tabs");
        this.repositories.forEach((x, i) => {
            let tb = i === 0 ? this.divElem("tab") : this.divElem("tab active");
            header.appendChild(tb);
            this.tabs.push(tb);
            tb.innerText = x.name;
            let tabHandler = () => {
                console.log(x.name);
                this.tabs.forEach(x => x.className = "tab");
                tb.className = tb.className + " active";
                this.current = x;
                this.reneder(x);
            };
            tb.addEventListener("click", tabHandler.bind(this));
        });

        document.getElementById("repos").appendChild(header);
        this.current = this.repositories[0];
        this.reneder(this.current);

        let filter = <HTMLInputElement>document.getElementById("filter");
        filter.addEventListener("keyup", () => {
            if (filter.value == "") {
                this.reneder(this.filter(filter.value, this.current))
            } else {
                this.reneder(this.current)
            }
        })

    }


    private divElem(...cl: string[]): HTMLDivElement {
        return <HTMLDivElement>this.element("div", ...cl)
    }

    private element(t: string, ...cl: string[]): HTMLElement {
        let r = document.createElement(t);
        r.className = cl.join(" ");
        return r
    }

    engine(tpl: string, data: Object) {
        var re = /\[\[([^\]]+)?\]\]/g, match;
        while (match = re.exec(tpl)) {
            let val: string;
            if (match[1] == "time" || match[1] == "date") {
                val = new Date(data[match[1]]).toLocaleString()
            } else {
                val = data[match[1]];
            }
            tpl = tpl.split(match[0]).join(val)
        }
        return tpl;
    }


    dateFormater(x: Date): string {

        return `${x.getFullYear()} ${monthNames[x.getMonth() - 1]} ${x.getDate()} ${x.getHours()}:${x.getMinutes()} `

    }

    filter(s: string, p: repository): repository {
        return <repository>{
            name: p.name,
            github: p.github,
            url: p.url,
            redmine: p.redmine,
            commits: p.commits.map(x => {
                const g = new RegExp(s);
                if (g.test(x.request) ||
                    g.test(x.author.name) ||
                    g.test(x.author.email)) {
                    return x;
                }
                for (var i = 0; i < x.tags.length; i++) {
                    if (g.test(x.tags[i].code.toString())) {
                        return p
                    }
                }
            })
        }
    }

    private reneder(p: repository) {
        let r = "";
        p.commits.forEach(x => {
            r += this.engine(commitTpl, {
                date: this.dateFormater(new Date(x.time)),
                hash: x.hash,
                message: x.request,
                tags: x.tags.map(y => this.engine(tagTpl, {redmine: p.redmine, code: y.code})).join(""),
                acronim: x.author.name.substr(0, 2).toUpperCase(),
                avatar: x.author.avatar,
                email: x.author.email,
                name: x.author.name,
                repository: p.github,

            });
        });

        document.getElementById("main").innerHTML = r;

    }
}

class manager {

    connectionId: string;
    ws: WebSocket;
    usernameField: HTMLInputElement = <HTMLInputElement>document.getElementById("username");
    passwordField: HTMLInputElement = <HTMLInputElement>document.getElementById("pass");
    messageField: HTMLDivElement = <HTMLDivElement>document.getElementById("warn");
    loginForm: HTMLDivElement = <HTMLDivElement>document.getElementById("login");


    constructor() {
        let ws = new WebSocket("ws://"+window.location.hostname+(location.port ? ':'+location.port: '')+"/ws");
        this.ws = ws;
        ws.onerror = (e) => {
            console.log(e)
        };
        ws.onmessage = this.msg.bind(this);
        ws.onopen =  this.open.bind(this);
        document.getElementById("submit").addEventListener("click", (e) => {
            e.preventDefault();
            console.log({
                id: this.usernameField.value,
                pass: this.passwordField.value,
                cid:this.getParameterByName("cid")||""
            });
            this.login({
            id: this.usernameField.value,
            pass: this.passwordField.value,
            cid:this.getParameterByName("cid")||""
        })})

    }
    getParameterByName(name) {
        let url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    showLogin() {
        this.cleanForm();
        this.loginForm.className = "show-login"
    }

    hideLogin() {
        this.cleanForm();
        this.loginForm.className = "hide-login"
    }

    cleanForm() {
        this.usernameField.value = "";
        this.passwordField.value = "";
        this.messageField.innerText = "";
    }

    login(l: login) {

        if (!l.pass || !l.id) {
            this.messageField.innerText = "Please enter your username and password";
            return
        }
        let d: message<login> = {
            kind: "login",
            data: l
        };
        this.ws.send(JSON.stringify(d))
    }

    msg(e: MessageEvent): any {
        let a = <message<any>>JSON.parse(e.data);
        if (typeof a.kind === "undefined")
            return;
        switch (a.kind) {
            case "id":
                this.connectionId = a.data;
                document.getElementById("cid").innerText = a.data;

                let im =  <HTMLImageElement>document.createElement("img");
                im.src =  qr(a.data);
                let holder =<HTMLDivElement>document.getElementById("qr")

                holder.innerHTML = ""
                holder.appendChild(im);


                break;
            case "token":
                localStorage.setItem("token", a.data);
                this.hideLogin();
                break;
            case "repositories":
                this.hideLogin();
                console.log(a);
                this.repo(<message<repository[]>>a);
                break;
            case "logout":
                this.logout();
            case "close":
                this.close()
        }
    }

    open() {
        let t = localStorage.getItem("token");
        if (t!== null ) {
            this.ws.send({
                kind: "token",
                data: t
            })
        } else {
            console.log(t);
            this.showLogin()
        }
    }



    repo(a: message<repository[]>) {
        new report(a.data);
    }

    logout() {
        localStorage.removeItem("auth");
        this.showLogin()
    }

    close() {
        window.close();
    }
}
const qrbase = "https://chart.googleapis.com/chart?cht=qr&chs=250x250&chld=h&chl=";
function qr(c: string): string {
    var protocol = location.protocol;
    var slashes = protocol.concat("//");
    var host = slashes.concat(window.location.hostname);
    return qrbase + host+(location.port ? ':'+location.port: '') + "/remote/?cid=" + c
}

class remote {
    qr: string;
    code: string;
}

class login {
    id: string;
    pass: string;
    cid:string;
}

class message<T> {
    kind: string;
    data: T;
}


new manager();