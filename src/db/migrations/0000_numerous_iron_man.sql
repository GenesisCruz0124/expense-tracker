CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`month` text NOT NULL,
	`amount_limit` integer NOT NULL,
	`alert_threshold_pct` integer DEFAULT 90 NOT NULL,
	`last_alert_pct` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budgets_category_month` ON `budgets` (`category_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_budgets_month` ON `budgets` (`month`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`category_id` integer,
	`frequency` text NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_run_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_next_run` ON `recurring_transactions` (`next_run_date`,`is_active`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`note` text,
	`category_id` integer,
	`recurring_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_occurred_at` ON `transactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category_id` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type_occurred_at` ON `transactions` (`type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category_occurred` ON `transactions` (`category_id`,`occurred_at`);