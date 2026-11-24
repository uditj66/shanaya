-- Who an appointment is for. Guests are stored one per mobile number per studio, but families share phones:
-- "book my sister-in-law Sakshi" on Sudha's number used to RENAME Sudha's guest record to Sakshi. Now the guest record
-- keeps the number's owner and each booking names the person actually coming in (null = the guest herself).
alter table public.bookings add column guest_name text check (guest_name is null or length(guest_name) between 1 and 80);
