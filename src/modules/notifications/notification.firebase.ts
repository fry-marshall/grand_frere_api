import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationFirebase implements OnModuleInit {
  private readonly logger = new Logger(NotificationFirebase.name);
  private firebaseApp: admin.app.App;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  onModuleInit() {
    if (this.configService.get('NODE_ENV') !== 'prod') {
      this.logger.log('Firebase initialization skipped (NODE_ENV is not prod)');
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    this.logger.log(
      `Firebase env check — FIREBASE_PROJECT_ID: ${projectId ? 'set' : 'MISSING'}, ` +
        `FIREBASE_PRIVATE_KEY: ${privateKey ? 'set' : 'MISSING'}, ` +
        `FIREBASE_CLIENT_EMAIL: ${clientEmail ? 'set' : 'MISSING'}`,
    );

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.error(
        'One or more FIREBASE_* env vars are missing — push notifications will not work',
      );
    }

    if (admin.apps.length > 0) {
      this.firebaseApp = admin.apps[0]!;
      this.logger.log('Firebase app already initialized, reusing instance');
      return;
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.getOrThrow('FIREBASE_PROJECT_ID'),
          privateKey: this.configService
            .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
          clientEmail: this.configService.getOrThrow('FIREBASE_CLIENT_EMAIL'),
        }),
      });
      this.logger.log('Firebase app initialized successfully');
    } catch (err) {
      this.logger.error(
        'Failed to initialize Firebase app',
        (err as Error).stack,
      );
      throw err;
    }
  }

  async send(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.warn(
        `Firebase app not initialized, skipping push for user ${userId}`,
      );
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmToken) {
      this.logger.debug(`No FCM token for user ${userId}, skipping push`);
      return;
    }

    try {
      await this.firebaseApp.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data,
      });
      this.logger.debug(`Push sent to user ${userId}`);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await this.userRepo.update(userId, { fcmToken: null });
        this.logger.warn(`Cleared invalid FCM token for user ${userId}`);
      } else {
        throw err;
      }
    }
  }
}
