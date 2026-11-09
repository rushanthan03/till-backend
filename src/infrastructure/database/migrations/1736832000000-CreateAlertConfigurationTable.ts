import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAlertConfigurationTable1736832000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'alert_configurations',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'restaurantId',
                        type: 'uuid',
                    },
                    {
                        name: 'pendingOrderReminderInterval',
                        type: 'int',
                        default: 5,
                    },
                    {
                        name: 'waiterConfirmationReminderInterval',
                        type: 'int',
                        default: 3,
                    },
                    {
                        name: 'orderOvertimeThreshold',
                        type: 'int',
                        default: 30,
                    },
                    {
                        name: 'itemOvertimeThreshold',
                        type: 'int',
                        default: 20,
                    },
                    {
                        name: 'enableImmediateAlerts',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'enablePendingOrderReminders',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'enableWaiterConfirmationReminders',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'enableOvertimeAlerts',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                ],
            }),
            true,
        );

        // Create unique index on restaurantId
        await queryRunner.createIndex(
            'alert_configurations',
            new TableIndex({
                name: 'IDX_alert_config_restaurant',
                columnNames: ['restaurantId'],
                isUnique: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('alert_configurations');
    }
}
