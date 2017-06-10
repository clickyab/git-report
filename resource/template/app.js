var commitTpl = "\n<div class=\"commit\">\n    <div class=\"timeline\">\n        <div class=\"icon icon-0\">\n            <div>[[acronim]]</div>\n            <img src=\"https://www.gravatar.com/avatar/[[avatar]]\" \n            alt=\"[[name]], [[email]]\">\n        </div>\n    </div>\n    <div class=\"info\">\n        <div class=\"details git\">\n            <h2>[[message]]</h2>\n            <a href=\"https://github.com/[[repository]]/commit/[[hash]]\">[[hash]]</a>\n            <div class=\"tags\">\n                [[tags]]\n            </div>\n            <div class=\"date\">[[date]]</div>\n        </div>\n    </div>\n</div>\n";
var tagTpl = " <a href=\"https://[[redmine]]/issues/[[code]]\" >#[[code]]</a>";
var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
];
var report = (function () {
    function report(d) {
        var _this = this;
        this.tabs = [];
        this.repositories = d;
        var header = this.divElem("tabs");
        this.repositories.forEach(function (x, i) {
            var tb = i === 0 ? _this.divElem("tab") : _this.divElem("tab active");
            header.appendChild(tb);
            _this.tabs.push(tb);
            tb.innerText = x.name;
            var tabHandler = function () {
                console.log(x.name);
                _this.tabs.forEach(function (x) { return x.className = "tab"; });
                tb.className = tb.className + " active";
                _this.current = x;
                _this.reneder(x);
            };
            tb.addEventListener("click", tabHandler.bind(_this));
        });
        document.getElementById("repos").appendChild(header);
        this.current = this.repositories[0];
        this.reneder(this.current);
        var filter = document.getElementById("filter");
        filter.addEventListener("keyup", function () {
            if (filter.value == "") {
                _this.reneder(_this.filter(filter.value, _this.current));
            }
            else {
                _this.reneder(_this.current);
            }
        });
    }
    report.prototype.divElem = function () {
        var cl = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            cl[_i] = arguments[_i];
        }
        return this.element.apply(this, ["div"].concat(cl));
    };
    report.prototype.element = function (t) {
        var cl = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            cl[_i - 1] = arguments[_i];
        }
        var r = document.createElement(t);
        r.className = cl.join(" ");
        return r;
    };
    report.prototype.engine = function (tpl, data) {
        var re = /\[\[([^\]]+)?\]\]/g, match;
        while (match = re.exec(tpl)) {
            var val = void 0;
            if (match[1] == "time" || match[1] == "date") {
                val = new Date(data[match[1]]).toLocaleString();
            }
            else {
                val = data[match[1]];
            }
            tpl = tpl.split(match[0]).join(val);
        }
        return tpl;
    };
    report.prototype.dateFormater = function (x) {
        return x.getFullYear() + " " + monthNames[x.getMonth() - 1] + " " + x.getDate() + " " + x.getHours() + ":" + x.getMinutes() + " ";
    };
    report.prototype.filter = function (s, p) {
        return {
            name: p.name,
            github: p.github,
            url: p.url,
            redmine: p.redmine,
            commits: p.commits.map(function (x) {
                var g = new RegExp(s);
                if (g.test(x.request) ||
                    g.test(x.author.name) ||
                    g.test(x.author.email)) {
                    return x;
                }
                for (var i = 0; i < x.tags.length; i++) {
                    if (g.test(x.tags[i].code.toString())) {
                        return p;
                    }
                }
            })
        };
    };
    report.prototype.reneder = function (p) {
        var _this = this;
        var r = "";
        p.commits.forEach(function (x) {
            r += _this.engine(commitTpl, {
                date: _this.dateFormater(new Date(x.time)),
                hash: x.hash,
                message: x.request,
                tags: x.tags.map(function (y) { return _this.engine(tagTpl, { redmine: p.redmine, code: y.code }); }).join(""),
                acronim: x.author.name.substr(0, 2).toUpperCase(),
                avatar: x.author.avatar,
                email: x.author.email,
                name: x.author.name,
                repository: p.github,
            });
        });
        document.getElementById("main").innerHTML = r;
    };
    return report;
}());
var manager = (function () {
    function manager() {
        var _this = this;
        this.usernameField = document.getElementById("username");
        this.passwordField = document.getElementById("pass");
        this.messageField = document.getElementById("warn");
        this.loginForm = document.getElementById("login");
        var ws = new WebSocket("ws://" + window.location.hostname + (location.port ? ':' + location.port : '') + "/ws");
        this.ws = ws;
        ws.onerror = function (e) {
            console.log(e);
        };
        ws.onmessage = this.msg.bind(this);
        ws.onopen = this.open.bind(this);
        document.getElementById("submit").addEventListener("click", function (e) {
            e.preventDefault();
            console.log({
                id: _this.usernameField.value,
                pass: _this.passwordField.value,
                cid: _this.getParameterByName("cid") || ""
            });
            _this.login({
                id: _this.usernameField.value,
                pass: _this.passwordField.value,
                cid: _this.getParameterByName("cid") || ""
            });
        });
    }
    manager.prototype.getParameterByName = function (name) {
        var url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
        if (!results)
            return null;
        if (!results[2])
            return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    };
    manager.prototype.showLogin = function () {
        this.cleanForm();
        this.loginForm.className = "show-login";
    };
    manager.prototype.hideLogin = function () {
        this.cleanForm();
        this.loginForm.className = "hide-login";
    };
    manager.prototype.cleanForm = function () {
        this.usernameField.value = "";
        this.passwordField.value = "";
        this.messageField.innerText = "";
    };
    manager.prototype.login = function (l) {
        if (!l.pass || !l.id) {
            this.messageField.innerText = "Please enter your username and password";
            return;
        }
        var d = {
            kind: "login",
            data: l
        };
        this.ws.send(JSON.stringify(d));
    };
    manager.prototype.msg = function (e) {
        var a = JSON.parse(e.data);
        if (typeof a.kind === "undefined")
            return;
        switch (a.kind) {
            case "id":
                this.connectionId = a.data;
                document.getElementById("cid").innerText = a.data;
                var im = document.createElement("img");
                im.src = qr(a.data);
                var holder = document.getElementById("qr");
                holder.innerHTML = "";
                holder.appendChild(im);
                break;
            case "token":
                localStorage.setItem("token", a.data);
                this.hideLogin();
                break;
            case "repositories":
                this.hideLogin();
                console.log(a);
                this.repo(a);
                break;
            case "logout":
                this.logout();
            case "close":
                this.close();
        }
    };
    manager.prototype.open = function () {
        var t = localStorage.getItem("token");
        if (t !== null) {
            this.ws.send({
                kind: "token",
                data: t
            });
        }
        else {
            console.log(t);
            this.showLogin();
        }
    };
    manager.prototype.repo = function (a) {
        new report(a.data);
    };
    manager.prototype.logout = function () {
        localStorage.removeItem("auth");
        this.showLogin();
    };
    manager.prototype.close = function () {
        window.close();
    };
    return manager;
}());
var qrbase = "https://chart.googleapis.com/chart?cht=qr&chs=250x250&chld=h&chl=";
function qr(c) {
    var protocol = location.protocol;
    var slashes = protocol.concat("//");
    var host = slashes.concat(window.location.hostname);
    return qrbase + host + (location.port ? ':' + location.port : '') + "/remote/?cid=" + c;
}
var remote = (function () {
    function remote() {
    }
    return remote;
}());
var login = (function () {
    function login() {
    }
    return login;
}());
var message = (function () {
    function message() {
    }
    return message;
}());
new manager();
