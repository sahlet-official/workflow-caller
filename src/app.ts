import express from 'express';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

function readSecret(secretName: string): string {
    try {
        return fs.readFileSync(`/run/secrets/${secretName}`, 'utf8').trim();
    } catch (error) {
        console.error(`Failed to read secret ${secretName}`, error);
        return 'No secret';
    }
}

app.get('/', (req, res) => {
    const secret = readSecret('github_private_key');
    if (!secret) {
        res.send(`Hello World! there is NOOOO secret.`);
    } else {
        res.send(`Hello World! there is secret.`);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});