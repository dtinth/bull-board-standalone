import {
  CommandLineAction,
  CommandLineIntegerParameter,
  CommandLineParser,
  CommandLineStringListParameter,
  CommandLineStringParameter,
} from '@rushstack/ts-command-line'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'
import Fastify from 'fastify'

class BullBoardCommandLine extends CommandLineParser {
  public constructor() {
    super({
      toolFilename: 'bull-board',
      toolDescription: 'BullMQ inspector',
    })
    this.addAction(new StartAction())
  }
  protected onDefineParameters(): void {}
}

class StartAction extends CommandLineAction {
  private _port!: CommandLineIntegerParameter
  private _concurrency!: CommandLineIntegerParameter
  private _redisUrl!: CommandLineStringParameter
  private _queueName!: CommandLineStringListParameter
  public constructor() {
    super({
      actionName: 'start',
      summary: 'Starts the server',
      documentation: 'Starts the server',
    })
  }
  protected onDefineParameters(): void {
    this._port = this.defineIntegerParameter({
      parameterLongName: '--port',
      parameterShortName: '-p',
      argumentName: 'PORT',
      environmentVariable: 'PORT',
      description: 'The port to listen on',
    })
    this._redisUrl = this.defineStringParameter({
      parameterLongName: '--redis-url',
      parameterShortName: '-r',
      argumentName: 'REDIS_URL',
      environmentVariable: 'REDIS_URL',
      description: 'The redis url to connect to',
    })
    this._queueName = this.defineStringListParameter({
      parameterLongName: '--queue-name',
      parameterShortName: '-q',
      argumentName: 'QUEUE_NAME',
      description: 'The queue name to listen to',
      required: true,
    })
  }
  protected async onExecute(): Promise<void> {
    if (!this._redisUrl.value) {
      throw new Error(
        'Missing Redis URL. You can set it with the --redis-url flag or the REDIS_URL environment variable',
      )
    }
    if (!this._queueName.values.length) {
      throw new Error('The queue name must not be empty')
    }
    const connection = new Redis(this._redisUrl.value, {
      maxRetriesPerRequest: null,
    })
    const queues = this._queueName.values.map(
      (name) =>
        new Queue(name, {
          connection,
        }),
    )
    const serverAdapter = new FastifyAdapter()
    createBullBoard({
      queues: queues.map((queue) => new BullMQAdapter(queue)),
      serverAdapter,
    })
    const fastify = Fastify({ logger: true })
    fastify.register(serverAdapter.registerPlugin())
    await fastify.listen({ port: this._port.value || 3042 })
  }
}

new BullBoardCommandLine().execute()
