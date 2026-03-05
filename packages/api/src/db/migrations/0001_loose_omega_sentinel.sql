CREATE TYPE "public"."sync_entity_status" AS ENUM('idle', 'running', 'error');--> statement-breakpoint
CREATE TABLE "appointments_mirror" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"month" varchar(7) NOT NULL,
	"date" varchar(10) NOT NULL,
	"time" varchar(8) DEFAULT '' NOT NULL,
	"patient_name" varchar(255) NOT NULL,
	"operator_name" varchar(255) DEFAULT '' NOT NULL,
	"value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"guide_number" varchar(100),
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals_mirror" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"specialty" varchar(255) DEFAULT 'Geral' NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professionals_mirror_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "report_summary_mirror" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer NOT NULL,
	"month" varchar(7) NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_appointments" integer DEFAULT 0 NOT NULL,
	"operators_summary" text DEFAULT '[]' NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" varchar(50) NOT NULL,
	"professional_id" integer,
	"month" varchar(7),
	"status" "sync_entity_status" DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_appt_mirror_external" ON "appointments_mirror" USING btree ("external_id","professional_id");--> statement-breakpoint
CREATE INDEX "idx_appt_mirror_prof_month" ON "appointments_mirror" USING btree ("professional_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_summary_mirror_prof_month" ON "report_summary_mirror" USING btree ("professional_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sync_log_entity" ON "sync_log" USING btree ("entity","professional_id","month");