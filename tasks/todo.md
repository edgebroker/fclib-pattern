# Build lib and verify REST components end-to-end

Build `Pattern.flowcomponents` with `./mklib.sh`, import it into a test FlowDirector app, wire up the route
`rooms/:id` with REST Route → REST Reply and check every status code with `curl -m 10`. No request may hang.

## Plan

- [x] Build `Pattern.flowcomponents` with `./mklib.sh` and check the archive contents
- [x] Start a local FlowDirector server (scratch directory, embedded router)
- [x] Create a test app and import the built lib into it
- [x] Create the Web API routes `rooms/:id` for GET, POST, PUT and DELETE
- [x] Build, deploy and activate a flow: REST Route → three REST Reply configurations
- [x] Check every status code over HTTP with `curl -m 10`
- [x] Check the REST Route branches that HTTP cannot reach, directly over JMS
- [x] Check concurrent requests (correlation, no hangs)
- [x] Record the setup and results (this file)

## Setup

Run on 2026-11-09, branch `task/1670-build-lib-and-verify-rest-components-end` at `057b8b9`.

### 1. Build the lib

```bash
./mklib.sh          # exit 0
unzip -l Pattern.flowcomponents
```

- 34,308 bytes, 75 entries, all under the top-level directory `Pattern/`.
- SHA-256 `1e205c85e7744d6000eecc1a15a56a08438f9f55ec199bf90caec9fe190eb856`.
- Contains `Pattern/Service/REST Route` (descriptor, icon, `init/handler.js`) and `Pattern/Service/REST Reply`
  (descriptor, icon, `links/input/Reply/handler.js`). `.DS_Store` and `.idea` are excluded.
- The artifact is not committed; `mklib.sh` recreates it.

### 2. FlowDirector server

- Bundle: `flowdirector_6.0.3_macos_aarch64.tar.gz` from the dev build (`build/flowdirector/work/dev/bundle`,
  built 2026-11-08 from develop). It includes the JDK, the embedded SwiftMQ router 13.02.04 (`flowdirector`) and
  the HTTP server on port 8080.
- Unpacked into `/tmp/fdtest-1670`. `scripts/.javahome` and `scripts/.executables` point to the bundled
  `graalvm-jdk`, then `scripts/startserver`. Ready after about 14 s (`GET /serverinfo` → release `6.0.3`).
- Three routers of the local network (`node1`–`node3`) connected to the embedded router's routing listener. The test
  flow was deployed to `flowdirector` only; nothing was deployed to `node1`–`node3`.

### 3. Test app and lib import

- `POST /app-create` with `{"appname":"resttest","title":"REST Test","icon":"api"}` (works while no app exists).
- Import: the new app's `flowcomponents/Pattern` is a git clone of the old `master` layout. It was replaced with the
  contents of the built archive (`rm -rf Pattern && unzip Pattern.flowcomponents`), which is what an upload does.
  `diff -r` against the repo's `Pattern/` was empty.
- Everything else was driven headless over the vert.x event bus (`ws://localhost:8080/eventbus/websocket`): login as
  `admin`, then the shell commands below. Node's built-in `WebSocket` is enough; the script sends
  `<app>.client.connect` (reply → client token) and then
  `<app>.client.service.request` with `{clienttoken, msgtype: "servicerequest", streamname: <shell>, id,
  body: {context: "/", command}}`, plus a heartbeat every 5 s. Command arguments are quoted with `"`, inner quotes
  doubled.

### 4. Routes and flow

```
$route.shell create "rooms/:id" "GET"    "false" "false"     # preconfirm off, authenticate off
$route.shell create "rooms/:id" "POST"   "false" "false"
$route.shell create "rooms/:id" "PUT"    "false" "false"
$route.shell create "rooms/:id" "DELETE" "false" "false"
$flow.shell  save "Rooms" "<flow JSON>" "true"
$flow.shell  deploy "Rooms" "flowdirector"
$flow.shell  activate "Rooms" "flowdirector"
```

Flow `Rooms`:

| Component | Properties | Wiring |
|---|---|---|
| REST Route | Route Topic `resttest.rooms.%`, Methods `GET, POST, PUT` (DELETE left out on purpose) | outputs `GET`, `POST`, `PUT`; ref `Request` → all three REST Reply |
| REST Reply "GET" | Status 200, Body Property `id`, Error Property `fail` | input from `GET` |
| REST Reply "POST" | Status 201, Error Property `error` | input from `POST` |
| REST Reply "PUT" | Status 200, Body Property `payload`, Error Property `error` | input from `PUT` |

`flows/generated/Rooms_generated.js` contains the lib's handler code verbatim; Methods reaches the handler as the
string array `["GET","POST","PUT"]`. The stream log shows `GREEN: Flow has been started`.

## Results

### HTTP, `curl -sS -i -m 10`, base `http://localhost:8080/api/resttest`

| # | Case | Request | Status | Body | Produced by |
|---|---|---|---|---|---|
| 1 | Path parameter | `GET /rooms/A` | 200 | `{"result":"A"}` | REST Reply (`_params.id` → property `id`) |
| 2 | Other id | `GET /rooms/B-42` | 200 | `{"result":"B-42"}` | REST Reply |
| 3 | Error property, status 200 | `GET /rooms/A?fail=Room%20is%20locked` | 400 | `{"error":"Room is locked"}` | REST Reply (200 + error → 400) |
| 4 | Body echo, configured status | `POST /rooms/A` `{"name":"Blue","seats":4}` | 201 | `{"name":"Blue","seats":4}` | REST Reply |
| 5 | Empty body | `POST /rooms/A` | 201 | `{}` | REST Reply |
| 6 | `_` fields dropped | `POST /rooms/A` `{"name":"Blue","_secret":"x"}` | 201 | `{"name":"Blue"}` | REST Reply + server |
| 7 | Body Property | `PUT /rooms/A?payload={"id":"A","seats":8}` | 200 | `{"id":"A","seats":8}` | REST Reply |
| 8 | `_http_status` from the flow kept | `PUT …?payload={"_http_status":404,"message":"Room not found."}` | 404 | `{"message":"Room not found."}` | REST Reply |
| 9 | Redirect | `PUT …?payload={"_http_status":302,"_location":"/api/resttest/rooms/B"}` | 302 | empty, `Location: /api/resttest/rooms/B` | REST Reply + server |
| 10 | Not an object | `PUT …?payload=[1,2]` | 200 | `{"result":[1,2]}` | REST Reply (wrapped) |
| 11 | Body Property missing | `PUT /rooms/A` | 500 | `{"error":"Body property 'payload' does not exist in the message"}` | REST Reply (also logged) |
| 12 | Error beats Body Property | `PUT …?payload={"a":1}&error=Room is full` | 400 | `{"error":"Room is full"}` | REST Reply |
| 13 | Method not in Methods | `DELETE /rooms/A` | 405 | `{"error":"Method not allowed."}` | REST Route |
| 14 | No route for the method | `PATCH /rooms/A` | 404 | empty | server |
| 15 | Unknown route | `GET /nothing/A` | 404 | empty | server |
| 16 | Invalid JSON body | `POST /rooms/A` `not json` | 400 | `Request body is not valid JSON` (text/plain) | server |
| 17 | JSON that is not an object | `POST /rooms/A` `[1,2]` (also `"str"`, `42`) | 500 | empty | server (see findings) |
| 18 | JSON `null` body | `POST /rooms/A` `null` | 201 | `{}` | REST Reply (server treats it as empty) |

All 17 matrix calls finished in about 1 s together; no curl exit 28 (timeout).

### Concurrency, `curl -m 10`

- 50 parallel `GET /rooms/R<n>`: 50 × 200, every response carries its own id. Replies are never crossed.
- 30 parallel mixed requests: 8 × 200 (GET), 8 × 201 (POST), 7 × 405 (DELETE), 7 × 500 (PUT without payload),
  matching the methods exactly; no timeouts.

### REST Route branches below HTTP (JMS, `smqp://localhost:44001`)

The FD server rejects non-object bodies itself (rows 16, 17), so REST Route's 400 branch cannot be reached over HTTP.
A small JMS client (`javax.jms`, `router/jars/swiftmq.jar`) published to `resttest.rooms.:id` with the properties
the server sets (`restrequest`, `requesttype`, `operation`), a temporary-queue ReplyTo and a correlation ID:

| Case | `operation` | Reply | Correlation ID |
|---|---|---|---|
| Text body not JSON | `GET` | `{"_http_status":400,"error":"Request body must be a JSON object."}` | matches |
| Text body JSON array | `GET` | `{"_http_status":400,"error":"Request body must be a JSON object."}` | matches |
| BytesMessage | `GET` | `{"_http_status":400,"error":"Request body must be a JSON object."}` | matches |
| No `operation` property | – | `{"_http_status":405,"error":"Method not allowed."}` | matches |
| Lower-case method | `get` | `{"result":"Z","_http_status":200}` | matches |
| Parameter name not a valid property (`bad-name`) | `GET` | `{"result":"Z","_http_status":200}` (request not failed) | matches |
| `_params.operation` = `DELETE` | `GET` | `{"result":"Z","_http_status":200}` (server property not overwritten) | matches |

### Coverage of the components' status codes

| Status | Source | Covered by |
|---|---|---|
| 200 | REST Reply default / `_http_status` kept | 1, 2, 7, 10 |
| 201 (configured) | REST Reply Status | 4, 5, 6 |
| 302 + Location | flow `_http_status` + `_location` | 9 |
| 400 | REST Reply error with status 200 | 3, 12 |
| 400 | REST Route body not a JSON object | JMS only (server answers first over HTTP) |
| 404 (flow) | flow `_http_status` | 8 |
| 405 | REST Route method not in Methods / no `operation` | 13, JMS |
| 500 | REST Reply Body Property missing | 11 |
| 500 | REST Route catch block / REST Reply build exception | not triggerable from outside; both send a reply before logging |

## Findings

1. **The `%` wildcard works.** The server publishes to `resttest.rooms.:id` literally. The REST Route on
   `resttest.rooms.%` receives every `/rooms/<id>` request, with the value in `_params.id`. This settles the
   "unverified" note in the `fd-build-rest` skill (section 1).
2. **Server bug, not in this lib:** a JSON body that is valid but not an object (`[1,2]`, `"str"`, `42`) gives 500
   with an empty body. `HttpServerVerticle` logs
   `ClassCastException: JsonArray cannot be cast to JsonObject`. Invalid JSON gets a proper 400. The skill
   documents the 500, so this is known behaviour, but a 400 like the invalid-JSON case would be consistent.
   Report this to the fdserver-launcher repo.
3. REST Route's 400 branch is a defensive path for publishers other than the FD HTTP server. Over HTTP the server
   answers first.
4. No component changes were needed. Every status the components produce over HTTP was observed, and no request
   hung.

## Review

- The lib builds reproducibly with `./mklib.sh` and imports as `Pattern/...`. Component paths in flows are
  `Pattern/Service/REST Route` and `Pattern/Service/REST Reply`.
- REST Route and REST Reply behave as described in their descriptors, with any status the flow sets and under
  concurrent load.
- Not covered: the Request-reference fallback in REST Reply. It applies only when a branch builds a new message
  without ReplyTo; this flow links REST Route straight to REST Reply. Raw (`text/plain`) replies were not part of
  the status-code matrix.
- The scratch server in `/tmp/fdtest-1670` was stopped after the run.
