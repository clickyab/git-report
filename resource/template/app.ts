
// const staticData = {}
interface viewCommit {
    aid: number;
    nin: string;
    ash: string;
    vms: string;
    csh: string;
    tags: string;
    date: string;
}
interface TagView {
    tc: string;
}
const commitTpl = `
<div class="commit">
    <div class="timeline">
        <div class="icon icon-[[aid]]">
            <div>[[nin]]</div>
            <img src="https://www.gravatar.com/avatar/[[ash]]" alt="">
        </div>
    </div>
    <div class="info">

        <div class="details git">
            <h2>[[vms]]</h2>
            <a href="https://github.com/okian/clickyab-cyrest/commit/[[csh]]">[[csh]]</a>
            <div class="tags">
                [[tags]]
            </div>
            <div class="date">[[time]]</div>
        </div>
        <div class="redmin">
[[cr]]
        </div>


    </div>
</div>
`
const tagTpl = ` <a href="https://tracker.clickyab.com/issues/[[tc]]" >#[[tc]]</a>`
const redminTmp =`<div class="cr" title="[[id]]">
                <div class="id">[[id]]</div>
                <div class="status status-[[statusid]]" title="[[status]]">[[statusid]]</div>
                <div class="subject">[[subject]]</div>
                <div class="description">[[description]]</div>
                <div class="priority">[[priority]]</div>
                <div class="author">[[author]]</div>
            </div>`

const monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
];
class App {
    constructor() {

        this.main = document.getElementById("main");
        this.report = JSON.parse(staticData)
        this.commits = this.report.commits;
        document.title = `Deploy report | ${this.report.time.toLocaleString()}`
        this.authors = this.report.authors;
        this.report.redmine.forEach(x=>console.log(x.id))
        console.log(this.report.redmine.length)
        let filter = document.getElementById("filter")
            .addEventListener("keyup", e => {
                //  let s = document.getElementById("filter").value;

                let s = e.target.value;
                this.filterCommit(s);


            })
        this.filterCommit("")
        
    }

    getRedmine(id:number):string {
        for (var i =0; i< this.report.redmine.length; i++) {
            if(this.report.redmine[i].id == id) {
                return  this.engine(redminTmp, this.report.redmine[i])
            }
        }
        return ""
    }
    updateView(w: Commit[]) {

        let tpl = '';
        w.forEach(x => {
            let tg = '';
            x.tags.forEach(t => {
                tg += this.engine(tagTpl, { tc: t.c })
            })
            const a = this.findAuthor(x.author_id);
            const tm = {
                aid: x.author_id,
                nin: a.name.substr(0, 2).toUpperCase(),
                ash: a.hash,
                vms: x.message.indexOf("\n") != -1 ? x.message.substr(0, x.message.indexOf("\n")) : x.message,
                csh: x.hash,
                tags: tg,
                time: this.dateFormater(new Date(x.time)),
                cr:''//this.getRedmines(x.tags.map(q=>q.c))
            }

            tpl += this.engine(commitTpl, tm)

        })
        this.main.innerHTML = tpl;

    }

    main: HTMLElement;
    report: Report;
    commits: Commit[];
    authors: Author[];
    findAuthor(x: number): Author {
        for (var i = 0; i < this.authors.length; i++) {
            if (this.authors[i].id == x)
                return this.authors[i]
        }
    }

    getRedmines(x :number[]):string {
        let r = ''
        x.forEach(t=>{r+= this.getRedmine(t)})

        return r
    }
    filterCommit(s: string) {

        let pat = new RegExp(`.*${s}.*`, "igm");
        const authors = this.authors
            .filter(x => pat.test(x.email) || pat.test(x.name))
            .map(x => x.id)
        let w = this.report
            .commits
            .filter(x => {
                if (authors.indexOf(x.author_id) != -1)
                    return true;
                if (pat.test(x.message))
                    return true;
                let isTag = false;
                x.tags.forEach(t => {
                    if (pat.test("#" + t.c.toString()))
                        isTag = true;
                })
                return isTag;
            })
        this.updateView(w)

    }
    dateFormater(x: Date): string {
        return `${x.getFullYear()} ${monthNames[x.getMonth() - 1]} ${x.getDate()} ${x.getHours()}:${x.getMinutes()} `
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
            tpl = tpl.split(match[0]).join( val)
        }
        return tpl;
    }
}
new App()

interface Report {
    time: Date;
    count: number;
    authors: Author[];
    commits: Commit[];
    redmine: Redmine[];
}
interface Redmine {
    id: number
    status: string
    statusid: number;
    subject: string
    description: string
    priority: string
    author: string
}

interface Commit {
    time: Date;
    hash: string;
    message: string;
    tags: Tag[];
    author_id: number;
}
interface Tag {
    c: number;
    t: string;
}
interface Author {
    id: number;
    name: string;
    email: string;
    hash: string;

}
