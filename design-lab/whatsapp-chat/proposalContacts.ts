export type Contact = { id: string; name: string; initials: string; phone: string | null; linked: boolean; unread: number; preview: string; time: string };

export const initialContacts: Contact[] = [
  { id: "martina", name: "Martina López", initials: "ML", phone: "+54 9 11 5555-4521", linked: true, unread: 0, preview: "m4", time: "10:42" },
  { id: "unknown", name: "+54 9 351 555-0192", initials: "?", phone: "+54 9 351 555-0192", linked: false, unread: 2, preview: "other1", time: "10:15" },
  { id: "federico", name: "Federico Díaz", initials: "FD", phone: "+54 9 11 5555-6789", linked: true, unread: 1, preview: "other2", time: "09:58" },
  { id: "javier", name: "Javier Pereyra", initials: "JP", phone: "+54 9 11 5555-7310", linked: false, unread: 0, preview: "other3", time: "yesterday" },
  { id: "laura", name: "Laura Méndez", initials: "LM", phone: "+54 9 11 5555-1212", linked: true, unread: 0, preview: "other4", time: "yesterday" },
  { id: "no-phone", name: "Sergio Gómez", initials: "SG", phone: null, linked: false, unread: 1, preview: "other5", time: "yesterday" },
];
