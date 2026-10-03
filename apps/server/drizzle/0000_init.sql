CREATE TABLE `checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`trend_kg` real,
	`rate_kg_per_week` real,
	`target_rate_kg_per_week` real NOT NULL,
	`weigh_ins` integer NOT NULL,
	`adjustment_kcal` integer NOT NULL,
	`adjustment_reason` text NOT NULL,
	`sessions_completed` integer NOT NULL,
	`sessions_planned` integer NOT NULL,
	`meal_adherence` real,
	`coach_note` text,
	`user_note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_week_start_unique` ON `checkins` (`week_start`);--> statement-breakpoint
CREATE TABLE `coach_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `day_overrides` (
	`date` text PRIMARY KEY NOT NULL,
	`workout_time` text,
	`day_type` text
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`session_id` integer NOT NULL,
	`muscle` text NOT NULL,
	`soreness` integer,
	`pump` integer,
	`workload` integer,
	`joint_pain` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`session_id`, `muscle`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`result` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status` ON `jobs` (`status`);--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`slot_index` integer,
	`option_id` text,
	`name` text NOT NULL,
	`macros` text NOT NULL,
	`status` text NOT NULL,
	`logged_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_logs_date` ON `meal_logs` (`date`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`source` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mesocycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan` text NOT NULL,
	`source` text NOT NULL,
	`start_date` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`onboarded_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`order` integer NOT NULL,
	`rep_min` integer NOT NULL,
	`rep_max` integer NOT NULL,
	`target_weight` real,
	`target_reps` text NOT NULL,
	`target_rir` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`prescription_note` text DEFAULT '' NOT NULL,
	`maxed_out` integer DEFAULT false NOT NULL,
	`substituted_from` text,
	`start_weight` real,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_exercises_session` ON `session_exercises` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_exercises_exercise` ON `session_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meso_id` integer NOT NULL,
	`week` integer NOT NULL,
	`day_index` integer NOT NULL,
	`label` text NOT NULL,
	`location` text NOT NULL,
	`status` text NOT NULL,
	`date` text,
	`started_at` text,
	`completed_at` text,
	`target_rir` integer NOT NULL,
	`is_deload` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`meso_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_slot` ON `sessions` (`meso_id`,`week`,`day_index`);--> statement-breakpoint
CREATE INDEX `sessions_date` ON `sessions` (`date`);--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_exercise_id` integer NOT NULL,
	`set_index` integer NOT NULL,
	`weight` real,
	`reps` integer NOT NULL,
	`rir` integer,
	`logged_at` text NOT NULL,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_logs_slot` ON `set_logs` (`session_exercise_id`,`set_index`);--> statement-breakpoint
CREATE TABLE `targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`effective_date` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weights` (
	`date` text PRIMARY KEY NOT NULL,
	`weight_kg` real NOT NULL,
	`source` text NOT NULL,
	`updated_at` text NOT NULL
);
