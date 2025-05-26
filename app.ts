import http from 'http';
import crypto from 'crypto';

const hostname = '127.0.0.1';
const port = 3000;
const waiting: { [id: string]: { description: string, callingDescription: string } } = {};
const waitingRev: { [description: string]: string } = {};

async function getBody(request: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
        const bodyParts: any[] = [];
        let body;
        request.on('data', (chunk) => {
            console.log('data');
            bodyParts.push(chunk);
        }).on('end', () => {
            console.log('end');
            body = Buffer.concat(bodyParts).toString();
            resolve(body);
        });
    });
}

function main() {
    const server = http.createServer(async (request, response) => {
        let urlStruct: URL | null = null;
        try {
            const fullUrl = 'http://host' + decodeURI(request.url || '');
            urlStruct = URL.parse(fullUrl);
            if (urlStruct === null) {
                console.error(request);
                throw new Error(`error parsing the url: ${fullUrl}`);
            }
            const url = urlStruct.pathname.split('/').filter(item => !!item).at(-1) || '';

            if (url === 'waiting' && request.method === 'POST') {
                const body: string = await getBody(request);
                const description: string = JSON.parse(body).description || '';

                if (description === '') {
                    throw new Error('empty description');
                }

                if (waitingRev[description]) {
                    response.statusCode = 200;
                    response.setHeader('Content-Type', 'application/json');
                    response.end(`{"id": "${waitingRev[description]}"}`);
                    response.end();
                } else {
                    let id = crypto.randomBytes(8).toString('hex');
                    while (waiting[id] !== undefined) {
                        id = crypto.randomBytes(8).toString('hex');
                    }

                    waiting[id] = {
                        description: description,
                        callingDescription: ''
                    };
                    waitingRev[description] = id;

                    response.statusCode = 200;
                    response.setHeader('Content-Type', 'application/json');
                    response.end(`{"id": "${id}"}`);
                }
            } else if (url === 'waiting' && request.method === 'GET') {
                const waitingId: string = urlStruct.searchParams.get('id') || '';
                const waitingEntry = waiting[waitingId];
                if (!waitingEntry) {
                    throw new Error('need id');
                }
                if (waitingEntry.callingDescription) {
                    throw new Error(`${waitingId} already in a call`);
                }

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end(`{"id": "${waitingId}", "description": "${waitingEntry.description}"}`);
            } else if (url === 'calling' && request.method === 'POST') {
                const body: string = await getBody(request);
                const waitingId: string = JSON.parse(body).waitingId || '';
                const callingDescription: string = JSON.parse(body).callingDescription || '';

                if (waitingId === '') {
                    throw new Error('empty waitingId');
                }
                if (callingDescription === '') {
                    throw new Error('empty callingDescription');
                }
                const waitingDescription = waiting[waitingId];
                if (!waitingDescription) {
                    throw new Error('invalid waitingId');
                }

                waitingDescription.callingDescription = callingDescription;

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end('{}');
            } else if (url === 'calling' && request.method === 'GET') {
                const waitingId: string = urlStruct.searchParams.get('id') || '';

                const waitingEntry = waiting[waitingId];
                if (!waitingEntry) {
                    throw new Error('need id');
                }

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end(`{"callingDescription": "${waitingEntry.callingDescription}"}`);

                if (waitingEntry.callingDescription) {
                    delete waiting[waitingId];
                }
            } else if (url === 'debug') {
                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(waiting));
            } else {
                throw new Error('unhandled endpoint');
            }
        } catch (error) {
            console.log(urlStruct);
            console.log(request.headers);
            console.log(request.url);
            console.log(request.method);

            // const body = await getBody(request);
            // console.log(body);

            response.statusCode = 404;
            response.setHeader('Content-Type', 'application/json');
            response.end('{"error": "that\'s an error"}');
            console.error(error);
        }
    });

    server.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
}

main();