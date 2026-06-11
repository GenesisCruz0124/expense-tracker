ALTER TABLE `account_categories` ADD `kind` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
UPDATE `account_categories` SET `kind` = 'credit_card' WHERE `name` = 'Credit card';