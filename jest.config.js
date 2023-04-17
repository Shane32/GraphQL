module.exports = {
    roots: ['<rootDir>/test', '<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)',
    ],
    testEnvironment: "jsdom",
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            './config/fileTransformer.js',
    },
    globals: {
        fetch: global.fetch,
        Request: global.Request,
        Response: global.Response,
        AbortController: global.AbortController,
        AbortSignal: global.AbortSignal,
        'ts-jest': {
            tsconfig: 'tsconfig.json'
        }
    },
    verbose: true,
    //testURL: "https://api.zbox.com/"
}
