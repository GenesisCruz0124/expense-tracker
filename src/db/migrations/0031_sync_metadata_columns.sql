ALTER TABLE `categories` ADD `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `categories` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `account_categories` ADD `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `account_categories` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `accounts` ADD `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `accounts` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `recurring_transactions` ADD `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `recurring_transactions` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `budgets` ADD `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `budgets` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `bills` ADD `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `bills` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `deleted_at` text;
