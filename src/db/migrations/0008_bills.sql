CREATE TABLE `bills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` integer,
	`account_id` integer,
	`due_date` text NOT NULL,
	`reminder_days_before` integer DEFAULT 1 NOT NULL,
	`reminded_at` text,
	`is_paid` integer DEFAULT false NOT NULL,
	`paid_transaction_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`paid_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bills_due_date` ON `bills` (`due_date`,`is_paid`);