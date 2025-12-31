import { spawn } from 'node:child_process';

const ENV_BY_FUNCTION = {
    generate: 'EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE',
    vision: 'EXPO_PUBLIC_CLOUD_FUNCTION_VISION',
    illustrate: 'EXPO_PUBLIC_CLOUD_FUNCTION_ILLUSTRATE',
    narrate: 'EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE',
    elevenlabsToken: 'EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN',
    intake: 'EXPO_PUBLIC_CLOUD_FUNCTION_INTAKE',
};

function collectFunctionUrls(output) {
    const urls = {};
    const lines = String(output || '').split('\n');
    for (const line of lines) {
        const match = line.match(/Function URL \(([^()]+)\([^)]*\)\):\s*(https?:\/\/\S+)/);
        if (!match) continue;
        const name = match[1].trim();
        const url = match[2].trim();
        if (!name || !url) continue;
        urls[name] = url;
    }
    return urls;
}

function printExpoEnvSnippet(urls) {
    const pairs = Object.entries(ENV_BY_FUNCTION)
        .map(([fnName, envVar]) => ({ fnName, envVar, url: urls[fnName] }))
        .filter((row) => typeof row.url === 'string' && row.url.trim());

    if (!pairs.length) return;

    console.log('\nExpo env vars (copy into `.env.local` / EAS env):\n');
    for (const { envVar, url } of pairs) {
        console.log(`${envVar}=${url}`);
    }
    console.log('');
}

const args = process.argv.slice(2);
const firebaseArgs = ['deploy', '--only', 'functions', ...args];

const child = spawn('firebase', firebaseArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    output += chunk.toString();
});

child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    output += chunk.toString();
});

child.on('close', (code) => {
    if (code !== 0) {
        process.exit(code || 1);
    }

    const urls = collectFunctionUrls(output);
    printExpoEnvSnippet(urls);
});
