CREATE TABLE `account_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_categories_name` ON `account_categories` (`name`);--> statement-breakpoint
INSERT INTO `account_categories` (`name`, `color`, `icon`) VALUES
	('Cash', '#22C55E', '💵'),
	('Bank', '#3B82F6', '🏦'),
	('E-wallet', '#A855F7', '📱'),
	('Credit card', '#F97316', '💳'),
	('Other', '#06B6D4', '🧾');--> statement-breakpoint
ALTER TABLE `accounts` ADD `category_id` integer REFERENCES account_categories(id);--> statement-breakpoint
UPDATE `accounts` SET `category_id` = (SELECT `id` FROM `account_categories` WHERE `name` = 'Cash') WHERE `type` = 'cash';--> statement-breakpoint
UPDATE `accounts` SET `category_id` = (SELECT `id` FROM `account_categories` WHERE `name` = 'Bank') WHERE `type` = 'bank';--> statement-breakpoint
UPDATE `accounts` SET `category_id` = (SELECT `id` FROM `account_categories` WHERE `name` = 'E-wallet') WHERE `type` = 'ewallet';--> statement-breakpoint
UPDATE `accounts` SET `category_id` = (SELECT `id` FROM `account_categories` WHERE `name` = 'Credit card') WHERE `type` = 'credit_card';--> statement-breakpoint
UPDATE `accounts` SET `category_id` = (SELECT `id` FROM `account_categories` WHERE `name` = 'Other') WHERE `type` = 'other' OR `category_id` IS NULL;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `type`;--> statement-breakpoint
ALTER TABLE `transactions` ADD `exclude_from_expense` integer DEFAULT false NOT NULL;
