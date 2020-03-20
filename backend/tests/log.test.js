/* eslint-env jest */
const request = require('supertest')
const { app } = require('../src/app')
const { sequelize } = require('../src/models')
const { mockLogs, expectedLogs } = require('./mocks/logs')
const { userPossibilitiesForCreate: { userWithValidData: userSignup }, userPossibilitiesForAuthenticate: { userWithValidData: userSignin } } = require('./mocks/user')

const authorization = []

const constantDate = new Date('2020-02-15T18:01:01.000Z')

global.Date = class extends Date {
  constructor () {
    return constantDate
  }
}

// ----- Funções usadas por todos os testes
async function signUp (user) {
  await request(app)
    .post('/users/signup')
    .send(user)
}

async function signIn (user) {
  const { body: { token } } = await request(app)
    .post('/users/signin')
    .send(user)
  authorization.push(token)
}

async function createLog (log) {
  return request(app)
    .post('/logs').send(log)
    .set('Authorization', `Bearer ${authorization[0]}`)
}

async function cleanDB () {
  await sequelize.sync({ force: true })
  authorization.pop()
}

// ----- all
beforeAll(async () => {
  await sequelize
    .sync({ force: true })
})
afterAll(async () => {
  await sequelize.drop()
  await sequelize.close()
})

// ----- Inicio dos testes
describe('The API on /logs endpoint at POST method should...', () => {
  beforeEach(async () => {
    await signUp(userSignup)
    await signIn(userSignin)
  })

  afterEach(async () => {
    await cleanDB()
  })

  test('returns 200 as status code and the result of the new log created', async () => {
    const res = await createLog(mockLogs.validLog)

    expect(res.body).toMatchObject(expectedLogs.oneLog)
    expect(res.statusCode).toEqual(200)
  })

  test('returns status code 406 and a message of error when a model is invalid', async () => {
    const res = await request(app).post('/logs')
      .send(mockLogs.invalidLogModel)
      .set('Authorization', `Bearer ${authorization[0]}`)

    expect(res.body).toMatchObject({ error: 'Log body is not valid' })
    expect(res.statusCode).toEqual(406)
  })

  test('returns status code 406 and a message of error when a type is invalid', async () => {
    const res = await request(app).post('/logs')
      .send(mockLogs.invalidLogType)
      .set('Authorization', `Bearer ${authorization[0]}`)

    expect(res.body).toMatchObject({ error: 'Log body is not valid' })
    expect(res.statusCode).toEqual(406)
  })

  test('returns status code 406 and a message of error when a date is invalid', async () => {
    const res = await request(app).post('/logs')
      .send(mockLogs.invalidLogDate)
      .set('Authorization', `Bearer ${authorization[0]}`)

    expect(res.body).toMatchObject({ error: 'Log body is not valid' })
    expect(res.statusCode).toEqual(406)
  })

  test('returns status code 500 and a message of error when a token is missing', async () => {
    const res = await request(app).post('/logs')
      .send(mockLogs.validLog)
      .set('Authorization', 'Bearer')

    expect(res.body).toMatchObject({
      error: {
        message: 'jwt must be provided',
        name: 'JsonWebTokenError'
      }
    })
    expect(res.statusCode).toEqual(500)
  })

  test('returns status code 500 and a message of error when a token is invalid', async () => {
    const res = await request(app).post('/logs')
      .send(mockLogs.validLog)
      .set('Authorization', 'Bearer um.token.qualquer')
    expect(res.body).toMatchObject({
      error: {
        message: 'invalid token'
      }
    })
    expect(res.statusCode).toEqual(500)
  })
})

describe('The API on logs/sender endpoint at GET method should...', () => {
  beforeEach(async () => {
    await signUp(userSignup)
    await signIn(userSignin)
  })

  afterEach(async () => {
    await cleanDB()
  })

  test('returns status code 200 and query result by registered App', async () => {
    await createLog(mockLogs.validLog)
    await createLog(mockLogs.validLog)

    const res = await request(app)
      .get('/logs/sender/App_1')
      .set('Authorization', `Bearer ${authorization[0]}`)

    expect(res.body).toEqual(expectedLogs.twoLogs)
    expect(res.statusCode).toEqual(200)
  })

  test('returns status code 406 and a message of error when the id nonexist', async () => {
    const res = await request(app)
      .get('/logs/sender/1')
      .send(mockLogs.getLogBySenderApp)
      .set('Authorization', `Bearer ${authorization[0]}`)

    expect(res.body).toMatchObject({
      message: 'Not acceptable',
      error: 'Nonexistent id'
    })
    expect(res.statusCode).toEqual(406)
  })
})
