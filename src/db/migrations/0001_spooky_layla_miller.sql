CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`starting_balance` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounts_name` ON `accounts` (`name`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `account_id` integer REFERENCES accounts(id);--> statement-breakpoint
CREATE INDEX `idx_transactions_account_id` ON `transactions` (`account_id`);