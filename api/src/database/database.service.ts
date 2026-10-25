import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as sql from 'mssql';
import databaseConfig from '../config/database.config';

/**
 * Point d'accès unique à la base. Un seul ConnectionPool pour toute l'application
 * (mssql gère déjà le pooling des connexions en interne).
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: sql.ConnectionPool;

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly config: ConfigType<typeof databaseConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.pool = await new sql.ConnectionPool({
      server: this.config.server,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        trustServerCertificate: this.config.trustServerCertificate,
        encrypt: this.config.encrypt,
      },
    }).connect();
    this.logger.log(
      `Connecté à SQL Server (${this.config.server}:${this.config.port}/${this.config.database})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.close();
  }

  /** Nouvelle requête hors transaction. */
  request(): sql.Request {
    return this.pool.request();
  }

  /**
   * Exécute `fn` dans une transaction : begin, puis commit si `fn` réussit,
   * rollback si elle lève une erreur (y compris une DomainError).
   */
  async withTransaction<T>(
    fn: (tx: sql.Transaction) => Promise<T>,
  ): Promise<T> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    try {
      const result = await fn(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export { sql };
