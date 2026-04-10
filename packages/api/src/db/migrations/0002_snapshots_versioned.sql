DROP TABLE IF EXISTS "report_snapshots" CASCADE;--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar(7) NOT NULL,
	"version" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshot_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"external_appointment_id" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"time" varchar(8) DEFAULT '' NOT NULL,
	"patient_name" varchar(255) NOT NULL,
	"operator_name" varchar(255) DEFAULT '' NOT NULL,
	"guide_number" varchar(100),
	"value" numeric(10, 2) NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"is_excluded" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshot_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"period" "shift_period" NOT NULL,
	"modality" "shift_modality" NOT NULL,
	"shift_value" numeric(10, 2) NOT NULL,
	"origin" varchar(50) DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshot_appointments" ADD CONSTRAINT "report_snapshot_appointments_snapshot_id_report_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."report_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshot_shifts" ADD CONSTRAINT "report_snapshot_shifts_snapshot_id_report_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."report_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_snapshot_month_version" ON "report_snapshots" USING btree ("month","version");--> statement-breakpoint
CREATE INDEX "idx_snapshot_month_active" ON "report_snapshots" USING btree ("month","is_active");--> statement-breakpoint
CREATE INDEX "idx_snap_appt_snapshot_prof" ON "report_snapshot_appointments" USING btree ("snapshot_id","professional_id");--> statement-breakpoint
CREATE INDEX "idx_snap_shift_snapshot_prof" ON "report_snapshot_shifts" USING btree ("snapshot_id","professional_id");
