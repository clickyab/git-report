var commitTpl = "\n<div class=\"commit\">\n    <div class=\"timeline\">\n        <div class=\"icon icon-[[aid]]\">\n            <div>[[nin]]</div>\n            <img src=\"https://www.gravatar.com/avatar/[[ash]]\" alt=\"\">\n        </div>\n    </div>\n    <div class=\"info\">\n\n        <div class=\"details git\">\n            <h2>[[vms]]</h2>\n            <a href=\"https://github.com/okian/clickyab-cyrest/commit/[[csh]]\">[[csh]]</a>\n            <div class=\"tags\">\n                [[tags]]\n            </div>\n            <div class=\"date\">[[time]]</div>\n        </div>\n        <div class=\"redmin\">\n[[cr]]\n        </div>\n\n\n    </div>\n</div>\n";
var tagTpl = " <a href=\"https://tracker.clickyab.com/issues/[[tc]]\" >#[[tc]]</a>";
var redminTmp = "<div class=\"cr\" title=\"[[id]]\">\n                <div class=\"id\">[[id]]</div>\n                <div class=\"status status-[[statusid]]\" title=\"[[status]]\">[[statusid]]</div>\n                <div class=\"subject\">[[subject]]</div>\n                <div class=\"description\">[[description]]</div>\n                <div class=\"priority\">[[priority]]</div>\n                <div class=\"author\">[[author]]</div>\n            </div>";
var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
];
var App = (function () {
    function App() {
        var _this = this;
        this.main = document.getElementById("main");
        this.report = JSON.parse(staticData);
        this.commits = this.report.commits;
        document.title = "Deploy report | " + this.report.time.toLocaleString();
        this.authors = this.report.authors;
        this.report.redmine.forEach(function (x) { return console.log(x.id); });
        console.log(this.report.redmine.length);
        var filter = document.getElementById("filter")
            .addEventListener("keyup", function (e) {
            //  let s = document.getElementById("filter").value;
            var s = e.target.value;
            _this.filterCommit(s);
        });
        this.filterCommit("");
    }
    App.prototype.getRedmine = function (id) {
        for (var i = 0; i < this.report.redmine.length; i++) {
            if (this.report.redmine[i].id == id) {
                return this.engine(redminTmp, this.report.redmine[i]);
            }
        }
        return "";
    };
    App.prototype.updateView = function (w) {
        var _this = this;
        var tpl = '';
        w.forEach(function (x) {
            var tg = '';
            x.tags.forEach(function (t) {
                tg += _this.engine(tagTpl, { tc: t.c });
            });
            var a = _this.findAuthor(x.author_id);
            var tm = {
                aid: x.author_id,
                nin: a.name.substr(0, 2).toUpperCase(),
                ash: a.hash,
                vms: x.message.indexOf("\n") != -1 ? x.message.substr(0, x.message.indexOf("\n")) : x.message,
                csh: x.hash,
                tags: tg,
                time: _this.dateFormater(new Date(x.time)),
                cr: '' //this.getRedmines(x.tags.map(q=>q.c))
            };
            tpl += _this.engine(commitTpl, tm);
        });
        this.main.innerHTML = tpl;
    };
    App.prototype.findAuthor = function (x) {
        for (var i = 0; i < this.authors.length; i++) {
            if (this.authors[i].id == x)
                return this.authors[i];
        }
    };
    App.prototype.getRedmines = function (x) {
        var _this = this;
        var r = '';
        x.forEach(function (t) { r += _this.getRedmine(t); });
        return r;
    };
    App.prototype.filterCommit = function (s) {
        var pat = new RegExp(".*" + s + ".*", "igm");
        var authors = this.authors
            .filter(function (x) { return pat.test(x.email) || pat.test(x.name); })
            .map(function (x) { return x.id; });
        var w = this.report
            .commits
            .filter(function (x) {
            if (authors.indexOf(x.author_id) != -1)
                return true;
            if (pat.test(x.message))
                return true;
            var isTag = false;
            x.tags.forEach(function (t) {
                if (pat.test("#" + t.c.toString()))
                    isTag = true;
            });
            return isTag;
        });
        this.updateView(w);
    };
    App.prototype.dateFormater = function (x) {
        return x.getFullYear() + " " + monthNames[x.getMonth() - 1] + " " + x.getDate() + " " + x.getHours() + ":" + x.getMinutes() + " ";
    };
    App.prototype.engine = function (tpl, data) {
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
    return App;
}());
new App();
