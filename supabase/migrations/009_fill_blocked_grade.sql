-- Rejeito can be packed into internal movement boxes, same as AAA/B/C.
ALTER TABLE fills DROP CONSTRAINT IF EXISTS fills_grade_check;
ALTER TABLE fills ADD CONSTRAINT fills_grade_check CHECK (grade IN ('AAA', 'B', 'C', 'blocked'));
