-- Soft-delete para appointments que sumiram da API externa
-- (ex: paciente mudou de convenio para particular no cPanel)
ALTER TABLE appointments_mirror
  ADD COLUMN source_gone boolean NOT NULL DEFAULT false;

ALTER TABLE report_snapshot_appointments
  ADD COLUMN source_gone boolean NOT NULL DEFAULT false;
