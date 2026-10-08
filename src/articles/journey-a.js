module.exports = [
  {
    oldSlug: 'dari-laptop-rosak-ke-cuba-pertama',
    title: 'From a Broken Laptop to My First Try: Where It All Began',
    slug: 'from-broken-laptop-to-first-attempt',
    tags: ['Story', 'Learning to Code', 'Getting Started'],
    excerpt: 'The true story of how a broken laptop forced me to learn from a phone, borrow a computer, and eventually write my first lines of code.',
    content: `It started with a flickering screen, a fan that grew louder by the day, and finally — silence. My laptop, my only window to the internet, died and refused to come back. At the time I did not know what a terminal was, what a web server was, and I had never imagined I would one day build something like Tukuk-OS.

### The First Shock: No Laptop, No Work

The first few months after the laptop died felt like losing a limb. I could still open links on my phone, but long typing, reading documentation, and trying code was torture. The small screen, the unfriendly on-screen keyboard, and browser tabs that the system killed after only two open tabs made learning almost impossible.

I started borrowing computers from friends and family. My "study sessions" were only half an hour at first because I felt guilty using someone else's machine. In those half hours I realised one thing: I did not need to learn many things at once, I only needed to learn **one thing every time I sat down**. One concept. One file. One function.

### The Phone as My First Classroom

The phone was actually my first classroom. I installed a text editor app that let me store code notes, then copy and paste them onto a friend's computer when the time came. I read Mozilla Developer Network pages patiently, rewrote HTML examples by hand on paper, and rebuilt the structure of pages I saw in tutorials.

Paper and pencil, ironically, were the best teachers. When I rewrote code by hand I noticed mistakes that had previously slipped past: unclosed tags, missing commas, and variable names that differed from one place to another.

### Why Breaking Was Also a Lesson

The broken laptop taught me something no tutorial teaches: **depending on one tool is a risk**. After that I started keeping all my notes in plain text that could be opened on any device. I learned to use the phone browser to test code, and I began to appreciate open source software because it let me reinstall an operating system on an old family machine.

A month later I installed Linux on an old computer I found at home. That machine was slow, but it was completely mine. From that machine I ran my first web server, indexed my first websites, and eventually built the search engine you are using today.

### A Routine That Saved Everything

From that frustration I built a routine that eventually became the foundation of everything. Three times a week I booked half an hour on a friend's computer or the old machine at home. I never tried to "learn Node.js" in one session — I learned **one function**, or **one HTML concept**, or **one terminal command**. At the end of each session I wrote three short sentences in my phone notes: what I learned, what was still confusing, and what I would try tomorrow.

This small routine beat every big study plan I had ever made. A "two hours a day" plan always failed in the first week because it was too large for a busy day. But half an hour, three times a week, was impossible to refuse — and collected over a year it came to about a hundred sessions. That is enough to move from "nothing" to "able to build something".

One more rule for the routine: **never leave a session without writing one line of code**. Even if it only printed text, one working line gave me momentum for the next session.

### Support I Did Not Expect

I expected this learning journey to be a lonely solo effort. In reality I was helped by several sources I could not have lived without. The MDN documentation became my daily reference — free, thorough, and full of examples I could copy straight away. Linux community forums helped me solve several installation problems that almost made me give up.

Most importantly, I had two friends who happened to be learning code too. We did not study together in the classic sense — we just messaged each other with silly questions: "why won't my file open?", "have you ever seen this error?". Having someone to ask, even if they do not know the answer either, reduces isolation considerably.

I also found that teaching what I had just learned accelerated my own understanding dramatically. When I explained the concept of a "function" to my younger sibling I had to carve it out clearly enough for myself.

### What I Take Away for You

If you are starting from a position of shortage — no new laptop, no great internet connection, no mentor — know that the Tukuk-OS story started far worse than that. A slow start is not an obstacle; it is the most effective class I ever attended. The tool in your hand is not what matters, but the decision to open one tutorial and finish it today.`
  },
  {
    oldSlug: 'belajar-ubuntu-dari-sifar-ke-terminal',
    title: 'Learning Ubuntu From Scratch: The Terminal That Scared Me',
    slug: 'learning-ubuntu-from-zero-to-terminal',
    tags: ['Linux', 'Ubuntu', 'Terminal', 'Learning to Code'],
    excerpt: 'My journey installing Ubuntu for the first time, fearing the black screen, and finally becoming comfortable directing an operating system purely with text.',
    content: `When I finally managed to install Ubuntu on that old computer, the first thing on screen was a black background with blinking text. My heart pounded. I had read friends say that one wrong command could destroy a system, so sitting in front of a terminal felt like holding a knife without knowing how to use it.

### Why Linux, Not Windows?

My choice of Ubuntu was not because I knew much about Linux. It was because Windows on that machine had become too slow and the licence was no longer valid. Ubuntu could be installed for free, it was light, and it came with a web server already included. I did not realise at the time that the "free" choice would open the door to my entire career.

After installation I spent the first two hours just finding where my files were. I looked for "My Computer" and found nothing. I looked for a menu bar at the bottom and only saw a line of text.

### I Was Scared of My Own Commands

In the first week I used the graphics only. I opened files, double-clicked, and avoided the terminal completely. But every tutorial I read started with \`sudo apt update\`. Every time I pasted that command I bit my finger. I did not know what \`sudo\` meant, what \`apt\` was, and why the system asked for a password.

What calmed me was reading that \`sudo\` means "do it as administrator" — the same concept as "Run as Administrator" in Windows I had used for years. \`apt\` was simply an app store. After two weeks that command became my morning routine, like opening the phone to check the weather.

### Anatomy of a Single Command

I started breaking every command into parts: the action, the options, and the target. \`ls -la\` means "list files, all files, with details". \`cd Documents\` means "enter the Documents folder". \`grep\` searches text. \`chmod\` changes permissions. When I saw a command as an ordinary sentence — verb, adjective, object — the fear disappeared.

I also learned the importance of \`man\` and \`--help\`: instead of memorising, I learned to search. My list of favourite commands lived in a text file that eventually became the "10 Terminal Commands" article on this blog.

### Six Commands I Wrote on Paper

My fear of the terminal came mostly from not knowing what would happen after I pressed Enter. The solution was simple and almost silly: I wrote the command on paper first, along with the meaning of each part, before pasting it into the terminal.

That paper held only six commands for the first week: \`ls\`, \`cd\`, \`pwd\`, \`cat\`, \`sudo apt update\`, and \`sudo apt install\`. Next to each I wrote a full sentence. For example: "sudo = do as administrator; apt = package store; update = refresh the package list". When I forgot, I referred to the paper, not Google — because the paper was written in my own language.

This practice taught me something no video teaches: **only memorise what you understand**. A command you do not understand will be forgotten within days and, worse, will be called again by accident later. A command you understand can be rebuilt from knowledge even if you forget the exact syntax.

After two weeks the paper grew into two pages, and I later moved it into a text file that became the "10 Terminal Commands" article on this blog.

### When I Broke the System (And Fixed It)

In week three I made the mistake I feared most: I ran an \`rm\` command with the wrong path and deleted a configuration folder that should have stayed. The system was still alive, but several services refused to start again after a reboot.

At first my heart stopped. Then I opened a browser and searched for the error I saw, line by line. In the process I learned about configuration files, how Linux services start, and the importance of keeping a copy of configuration before changing anything.

I fixed the system in about an hour, and it became the densest learning session I have ever experienced. After that incident I set two permanent rules: back up before changing configuration, and always read the \`rm\` command twice before pressing Enter. I still follow both rules today, including while maintaining the real Tukuk-OS server.

Most importantly I learned that a mistake is not proof that I do not belong here — it is the system telling me I have not understood a part yet.

### What Linux Taught Me About Software

Linux taught me that an operating system is just a collection of files and services that can be directed. No magic. When I managed to restart a web service with \`systemctl restart\`, I realised that the web server I had been using all along — which I had always treated as a mysterious black box — could actually be fully controlled with a few commands.

That was the moment I stopped being a software user and started being a software builder. The Tukuk-OS was eventually born from that Ubuntu installation.`
  },
  {
    oldSlug: '10-perintah-terminal-yang-saya-hafal',
    title: '10 Terminal Commands I Memorised and Still Use Every Day',
    slug: '10-terminal-commands-i-still-use',
    tags: ['Terminal', 'Linux', 'Productivity'],
    excerpt: 'The real commands I use daily to manage the Tukuk-OS server, from basic navigation to searching logs and controlling services.',
    content: `After years of using the terminal I noticed that90 percent of my work uses only about ten commands. The rest I look up again when needed. This is the list I rewrote on my first day of learning Linux, and the same list I still use every day to maintain Tukuk-OS.

### 1. \`ls -la\` — See Everything

The first command I memorised. \`ls\` lists the contents of a folder, \`-a\` shows hidden files (those starting with a dot, like \`.env\`), and \`-l\` gives full details: owner, permissions, size, and date. When I am confused about "where is this file?", this is the answer.

### 2. \`cd\` — Change Place

\`cd\` changes the current directory. I use \`cd ..\` to go up one level, \`cd -\` to return to the previous directory, and \`cd ~\` to go home. These three variants alone save me from typing full paths over and over.

### 3. \`pwd\` — Where Am I?

When I dive too deep into a project folder and lose my bearings, \`pwd\` (print working directory) prints the full path. Tiny, but it saves me from creating files in the wrong place.

### 4. \`grep\` — Find Text Inside Files

\`grep -r "error" logs/\` searches for the word "error" in every file under the logs directory. I use this whenever something goes wrong. The \`grep -i\` version ignores case, and \`grep -n\` adds line numbers so I can jump straight to the location.

### 5. \`cat\` and \`less\` — Read Files

\`cat\` prints an entire file to the screen. For long files I use \`less\` because it lets me scroll. \`tail -f\` shows the contents of a file live — very useful for watching server logs while I test a change.

### 6. \`systemctl\` — Control Services

On modern Ubuntu, \`systemctl status tukuk-os\` tells me whether my server is alive, \`systemctl restart tukuk-os\` restarts it, and \`journalctl -u tukuk-os\` shows the logs. These three commands are the heartbeat of Tukuk-OS daily operations.

### 7. \`ps\` and \`top\` — Who Is Eating Resources?

\`ps aux\` lists all processes, while \`top\` (or \`htop\`) shows live CPU and memory usage. When the server is slow these are the first two commands I run to find the culprit.

### 8. \`chmod\` and \`chown\` — File Permissions

Hidden files like \`.env\` contain secret keys. \`chmod 600 .env\` ensures only the owner can read it. \`chown\` changes the owner. Permission mistakes are the most common reason a server fails to start, and both commands solve it in five seconds.

### 9. \`df -h\` and \`du -sh\` — Disk Almost Full?

\`df -h\` shows overall disk space remaining, while \`du -sh folder\` shows the size of each folder. Whenever storage runs low I hunt the largest folders with \`du -sh * | sort -h\`.

### 10. \`curl\` — Test From Outside

\`curl -I https://tukuk.org\` sends a HEAD request and shows the response code. \`curl localhost:8000/health\` tests the server directly before I open a browser. To me, \`curl\` is the stethoscope of a server administrator.

### A Real Session Using the Whole List

To show how these ten work together, here is a real session fixing a problem on the Tukuk-OS server one evening. The server had slowed down, so I started with \`top\` and saw one process consuming an abnormal amount of memory. I used \`ps aux\` to identify the process precisely, then \`systemctl status\` to see whether it was a service I recognised.

Next I needed to know whether the problem was new or old. \`pwd\` confirmed my current directory, \`ls -la\` showed log files with their dates, and \`tail -f\` opened the log live so I could watch what happened as I restarted the service. Inside the log I searched for the word "timeout" with \`grep -r\`, which led me to a particular configuration file.

Before touching that file I read it with \`less\`, then checked its permissions with \`ls -la\` to make sure the owner was correct. After making the change I restarted the service with \`systemctl restart\`, verified the response with \`curl localhost:8000/health\`, and finally checked disk space with \`df -h\` to make sure logs were not filling the storage.

The whole session took about ten minutes and used almost the entire list. None of the commands are special — the value is in how they are arranged into one smooth problem-solving process.

### Why Memorise a Little, Search a Lot

I do not memorise a hundred commands. I memorise ten that unlock everything, and I know where to find the rest. That is real terminal skill: not memory, but the ability to investigate. With just these ten commands you can already maintain a production web server completely — even one like Tukuk-OS.`
  },
  {
    oldSlug: 'laman-html-css-pertama-saya',
    title: 'My First HTML and CSS Page: From a Blank Screen to a Living Page',
    slug: 'my-first-html-and-css-page',
    tags: ['HTML', 'CSS', 'Web Design', 'Learning to Code'],
    excerpt: 'Building a first web page with no template: understanding document structure, colour choices, and the disbelief when the browser displays your work.',
    content: `I still remember the moment my browser displayed a page I had written myself for the first time. No page builder, no template, no drag-and-drop builder — just one file called \`index.html\` that I had typed patiently for two hours. When I pressed F5 and saw my heading and paragraphs appear, the feeling beat the joy of any video game.

### HTML: Skeleton, Not Decoration

My first lesson was understanding that HTML is **structure**. Every element is a box: \`<h1>\` for the main heading, \`<p>\` for a paragraph, \`<a>\` for a link, \`<img>\` for an image. I learned that tags open and close, and my most common mistake was forgetting to close one tag until the whole page fell apart.

I also learned the meaning of labels. \`<div>\` is just an empty container, while \`<section>\`, \`<article>\` and \`<nav>\` give the document meaning. At first I considered this pedantic decoration; then I understood that search engines like Tukuk-OS itself read this structure to understand what a page is about.

### CSS: Where Life Comes in Colour

If HTML is the bones, CSS is the skin and clothing. My first line of CSS was \`body { background-color: #f0f0f0; }\` and changing the background colour felt like painting a house for the first time. I then learned about \`margin\` (space outside) and \`padding\` (space inside), the two concepts that took me longest to distinguish.

The secret that helped me: I drew boxes on paper. Every element has three layers — content, padding, border, margin — and when I saw it as a postcard, the "box model" stopped being confusing.

### My First Design Mistakes

My first page was full of bright colours, fonts of every size, and animations I found in tutorials. It was ugly. I later learned three rules that saved my design: limit yourself to two or three colours, use a consistent heading size scale, and give space generously. Whitespace is not wasted space — it is the space that lets the eye rest.

I also learned the basics of responsiveness: the \`viewport\` meta tag and media queries. When I opened my page on a phone and it did not jitter all over the screen, I realised that good design starts with respecting different screens.

### Tools I Used (All Free)

At first I wrote HTML in Notepad, and that was actually not bad training — it forced me to memorise the basic structure until it became automatic. When my files grew I switched to an open source code editor that gave me line numbers and syntax highlighting. The difference was sudden: errors that had been hidden in the middle of a file now jumped to the eye.

I also installed the developer tools that come built into every modern browser. The "Elements" tab lets me see the actual boxes my CSS generates, including the padding and margin that do not show. I spent hours just changing values live and watching how the page responded — a free practice session that needed no file saving.

The biggest discovery was that almost everything I needed was already free and installed. I bought no software during the entire first year. The only real investment was time — and that is something no amount of money can buy.

### Layout: Where Design Is Really Decided

After months of changing colours and fonts I noticed my pages still did not look "clean" even though every element was beautiful on its own. The problem was layout — how elements group together and how space is shared between them.

I learned three layout concepts that solved almost all my problems. First, **a single grid**: one centred container with a sensible maximum width, so text never becomes too long to read. Second, **vertical rhythm**: consistent spacing between sections so the eye has stable expectations. Third, **priority**: one main element (usually the heading) must attract first attention, and everything else recedes.

When I fixed those three things on my first page it instantly changed from "a group of elements" to "a designed page". That lesson holds to this day — Tukuk-OS's layout is still built on a single grid, consistent vertical rhythm, and one accent colour that draws first attention.

### From a Dead Page to a Live Server

After several static pages I wanted to see my files served to other devices. I installed Node.js, wrote ten lines of web server, and served that \`public\` folder. When my younger sibling opened that address on their phone and saw my page, the concept of "a website" stopped being abstract. It was a file actually being sent across a network.

### Lessons I Still Use in Tukuk-OS

Tukuk-OS's design today still carries the DNA of my first page: one accent colour, consistent typography, generous padding, and a layout that works on phones. New templates I write always start with pure HTML and CSS before any JavaScript, because I believe if something does not work without JS it is not good enough yet.`
  },
  {
    oldSlug: 'javascript-pertama-saya',
    title: 'My First JavaScript: When the Page Started Talking Back',
    slug: 'my-first-javascript',
    tags: ['JavaScript', 'Frontend', 'Learning to Code'],
    excerpt: 'Learning JavaScript: from an embarrassing alert() to understanding events, the DOM, and how JavaScript turns a static page into an application.',
    content: `HTML gave me structure, CSS gave me colour, but my pages were still rigid. Buttons I clicked did nothing. Forms I filled did not submit. JavaScript was the language that finally gave those pages breath — and learning it was full of "aha" moments I will never forget.

### First Line: The Embarrassing alert()

My first JavaScript line was \`alert('Hello World')\`. It worked, but it also taught me that JavaScript runs in the user's browser, not on the server. Later I put an \`alert\` in a page while showing my work to a friend, and the box appeared three times in a row because I had placed the script in the wrong spot. Humbling, but I never forgot the lesson about where scripts belong.

### Understanding Events

The biggest concept I mastered first was **events**. The page waits, and my code responds. \`click\`, \`submit\`, \`input\`, \`keydown\` — when I understood that JavaScript is a system of listeners, everything became clear. I wrote my first contact form that showed a thank-you message without reloading the page, and it felt like magic.

I also learned the classic mistake: calling a function directly (\`onclick="handler()"\`) instead of \`addEventListener\`. The first works at first, but it binds my logic into HTML and makes maintenance hard. Moving to event listeners made my code far cleaner.

### The DOM: Editing a Live Page

The Document Object Model taught me that a living page can be changed through code. \`document.querySelector\` finds an element, \`.textContent\` changes the text, \`.classList\` adds a class. I built a small calculator, then a bookmark tool, then a weather widget that fetched data from an API.

The hardest part was understanding that every DOM change can be expensive. At the time I did not know about reflow and repaint; I just noticed that calling a function refreshing a hundred elements a hundred times made the page slow. That lesson later shaped how I write image edits in Tukuk-OS, where I append new results into an existing grid instead of rebuilding the whole list.

### async/await: JavaScript That Waits

When I started calling APIs I ran into promises. At first stacked \`then\` callbacks made my code look like a layer cake that was hard to read. Then I learned \`async/await\` and my code became linear at once: fetch data, process, display. To this day, every Tukuk-OS endpoint — from NASA data to image search results — is written with the \`async/await\` pattern I learned that evening.

### Debugging: The Real Weapon of a Developer

The skill I developed longest, and one tutorials rarely teach, is how to find bugs. Tutorials always show working code; real life is full of broken code where nobody tells you where the problem is.

My first tool was \`console.log\`. I planted it everywhere: before and after every step, inside every function, at every branch. The method is crude but effective — it forces me to think explicitly about the value I expect versus the actual value. Usually my bug was not on the broken line, but in the data arriving long before it.

The second, more powerful tool, was the debugger breakpoint. When I learned to set a stop on one line and watch variable values as execution paused, debugging changed from guessing to investigating. One session with breakpoints taught me more about how my code actually runs than hours of re-reading files.

The biggest debugging lesson: **never fix a bug you do not understand**. At first I would change three words randomly until the error disappeared, only to find it return later. Now I read the error message until I can explain it in my own words. If I cannot explain it, I am not ready to fix it.

### Why JavaScript Matters for Tukuk-OS

Tukuk-OS combines two worlds: Node.js on the server and JavaScript in the browser. Because I am fluent in one language only, I can move between them without mental translation. Search scoring logic, rendering image results, and handling contact forms all share the same DNA.

My advice to beginners: do not try to master all of JavaScript at once. Master variables, functions, objects, and the DOM. Those four are enough to build something real. The rest — modules, classes, bundlers — will come when you need them. And believe me, you will need them soon.`
  },
  {
    oldSlug: 'nodejs-pelayan-pertama-saya',
    title: 'Node.js and My First Web Server: Hello From the Terminal',
    slug: 'my-first-nodejs-server',
    tags: ['Node.js', 'Backend', 'Web Servers'],
    excerpt: 'Installing Node.js, writing a ten-line web server, and discovering why using one language for browser and server changed how I build software.',
    content: `For years I only built things that ran in the browser. My JavaScript was limited to static pages. When I wrote my first web server with Node.js and saw \`Hello from my terminal\` displayed on someone else's screen over the network, the boundary between "user" and "builder" collapsed at once.

### Why Node.js?

My choice was simple: I already knew JavaScript. Alternatives like Python and PHP always felt heavy because I had to learn new syntax, new libraries, and new ways to deploy. Node.js let me use the functions, objects, and \`async/await\` I already knew — only this time running outside the browser.

I also liked that Node was light and fast to start. One \`node server.js\` and the server is alive. No build step, no heavy control panel. For someone learning while working with limited hardware, that time-to-start matters enormously.

### Ten Lines That Changed Everything

My first server was roughly this: import \`http\`, create a server, listen on a port, send text. I ran it, opened \`localhost:3000\`, and saw my text. Then I changed the host to \`0.0.0.0\` so other devices on the network could access it, and my phone displayed the same page. I had my own server.

An hour later I realised anyone could access my server if they knew the IP address. That was the first time I learned about firewalls and, much later, about tunnels like Cloudflare Tunnel that eventually became the way Tukuk-OS is hosted on the internet today.

### Express: The Framework That Makes Life Easy

After playing with raw \`http\` I installed Express. The first lesson: routes. \`app.get('/hello', handler)\` — that statement reads like an English sentence. I started building APIs: \`/api/time\`, \`/api/greet\`, and then APIs that called external APIs.

I also learned middleware — functions that run before a response is sent. The concept initially seemed like unnecessary layering, until I needed it for logging and rate limiting. Middleware is where my server changed from a toy into a dependable system.

### Handling Errors Without Crashing

My first server would die on any error. One uncaught \`throw\` and the whole process ended. I learned \`try/catch\` not as syntax but as etiquette: every external call — API call, file read, database connection — can fail, and the server is responsible for staying alive no matter what happens.

That pattern now applies everywhere in Tukuk-OS. Every call to NASA, Bing, YouTube, or Meilisearch is wrapped in a \`try/catch\` with its own fallback, because I have seen a server die over one failed \`fetch\` in the morning.

### Secrets and the .env File

In my first week I stored API keys directly in source code. It worked until I wanted to share my code with others, and at that point I had to decide whether to expose my keys to the world. The third option — moving secrets to a separate file that never enters version control — did not occur to me until I read a security guide.

The solution was a \`.env\` file: a plain text file containing \`KEY=value\` pairs, read by the server at startup, and added to \`.gitignore\` so it never enters version history. Since then every project of mine — Tukuk-OS included — uses the same pattern.

I also learned that secrets are not only API keys. Database passwords, webhook tokens, and cloud storage access keys all deserve the same treatment. And I learned that rotating a leaked key is tedious work — so avoid getting there in the first place.

### How I Test a Server

At first my testing was opening a browser and seeing whether the page appeared. That worked for two or three routes, but when my server had twenty routes the method failed because I no longer remembered everything that needed checking.

I started writing a simple checklist: every time I added a new route I would test the most fragile old ones — the main search, the blog page, and the health endpoint. I also put \`curl\` into my routine, testing every route straight from the terminal without opening a browser.

One simple spread changed everything: when I added a new feature I also wrote a quick check ensuring old features still worked. Even a few basic tests gave me confidence to change code without fear of breaking something stable. The concept of "testing" I built at night later grew into a full test suite that now protects every important Tukuk-OS route.

### Express in Tukuk-OS

When I started building Tukuk-OS I did not think twice about the framework. Express carries dozens of routes: search, blog, NASA, experiments, contact forms, and internal APIs. My middleware stack — rate limiting, API keys, logging — all grew out of the experience of building that ten-line server.

If you are starting out, do not wait to understand the whole Node ecosystem. Write a server that displays text, then one that reads a JSON file, then one that calls an external API. Those three steps alone will take you further than any book.`
  }
];
