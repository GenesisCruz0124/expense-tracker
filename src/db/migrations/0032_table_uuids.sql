ALTER TABLE `categories` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_uuid` ON `categories` (`uuid`);
--> statement-breakpoint
ALTER TABLE `account_categories` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_categories_uuid` ON `account_categories` (`uuid`);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounts_uuid` ON `accounts` (`uuid`);
--> statement-breakpoint
ALTER TABLE `recurring_transactions` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recurring_transactions_uuid` ON `recurring_transactions` (`uuid`);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transactions_uuid` ON `transactions` (`uuid`);
--> statement-breakpoint
ALTER TABLE `budgets` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budgets_uuid` ON `budgets` (`uuid`);
--> statement-breakpoint
ALTER TABLE `bills` ADD `uuid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bills_uuid` ON `bills` (`uuid`);
