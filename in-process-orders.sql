-- To run when I have access to the database again

ALTER TABLE customerorder ADD is_in_process BOOLEAN;

UPDATE customerorder SET is_in_process=TRUE WHERE is_in_process IS NULL;