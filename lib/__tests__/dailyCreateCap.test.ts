let docExists = false;
let docData: Record<string, any> = {};
let configDocExists = false;
let configDocData: Record<string, any> = {};

const mockUserRef = {
    get: jest.fn(async () => ({ exists: docExists, data: () => docData })),
};

const mockConfigRef = {
    get: jest.fn(async () => ({ exists: configDocExists, data: () => configDocData })),
};

const mockCollection = jest.fn((_db: any, path: string) => ({ path }));
const mockDoc = jest.fn((collectionRef: any, _docId: string) => {
    if (collectionRef?.path === 'config') return mockConfigRef;
    return mockUserRef;
});
const mockRunTransaction = jest.fn(async (_db: any, updateFunction: any) => {
    const tx = {
        get: jest.fn(async () => ({ exists: docExists, data: () => docData })),
        set: jest.fn((_ref: any, data: any, options?: { merge?: boolean }) => {
            docExists = true;
            docData = options?.merge ? { ...docData, ...data } : data;
        }),
    };
    return updateFunction(tx);
});

const mockSetDoc = jest.fn(async (_ref: any, data: any, options?: { merge?: boolean }) => {
    docExists = true;
    docData = options?.merge ? { ...docData, ...data } : data;
});

jest.mock('@react-native-firebase/firestore', () => ({
    collection: mockCollection,
    doc: mockDoc,
    runTransaction: mockRunTransaction,
    setDoc: mockSetDoc,
}));

jest.mock('../firebase', () => ({
    firestore: { kind: 'firestore' },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dailyCreateCap = require('../dailyCreateCap') as typeof import('../dailyCreateCap');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../appConfig') as typeof import('../appConfig');

describe('lib/dailyCreateCap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        appConfig.resetAppRuntimeConfigCache();
        docExists = false;
        docData = {};
        configDocExists = false;
        configDocData = {};
    });

    it('treats an old date as 0 used', async () => {
        docExists = true;
        docData = { dailyCreateDate: '1999-12-31', dailyCreateCount: 7 };

        const state = await dailyCreateCap.fetchDailyCreateState('user-1');
        expect(state.countToday).toBe(0);
        expect(state.remaining).toBe(state.limit);
    });

    it('increments and resets when the stored day differs', async () => {
        docExists = true;
        docData = { dailyCreateDate: '1999-12-31', dailyCreateCount: 7 };

        const state = await dailyCreateCap.incrementDailyCreateCount('user-1');
        expect(state.countToday).toBe(1);

        const expectedKey = dailyCreateCap.getDateKeyNow(dailyCreateCap.getDeviceTimeZone());
        expect(docData.dailyCreateDate).toBe(expectedKey);
        expect(docData.dailyCreateCount).toBe(1);
    });

    it('increments when already on today', async () => {
        const todayKey = dailyCreateCap.getDateKeyNow(dailyCreateCap.getDeviceTimeZone());
        docExists = true;
        docData = { timeZone: dailyCreateCap.getDeviceTimeZone(), dailyCreateDate: todayKey, dailyCreateCount: 3 };

        const state = await dailyCreateCap.incrementDailyCreateCount('user-1');
        expect(state.countToday).toBe(4);
        expect(docData.dailyCreateCount).toBe(4);
    });

    it('blocks when limit reached', async () => {
        const todayKey = dailyCreateCap.getDateKeyNow(dailyCreateCap.getDeviceTimeZone());
        docExists = true;
        docData = { dailyCreateDate: todayKey, dailyCreateCount: dailyCreateCap.DAILY_CREATE_LIMIT };

        await expect(dailyCreateCap.assertUnderDailyCreateCap('user-1')).rejects.toThrow('Daily generation limit reached');
    });
});
