# Expense Plus (For SARAVANA)

## Offline-First Architecture

```
[ User Input ] -> [ Immediate Optimistic Local UI Update ]
                          |
               [ Save to LocalStorage / IndexedDB ]
                          |
         Is Internet Available (navigator.onLine)?
                 /                         \
             [YES]                         [NO]
               |                             |
   [ Push to Neon DB ]            [ Enqueue in Offline Queue ]
                                         |
                                [ On Reconnect / Heartbeat ]
                                         |
                               [ POST /api/expenses/sync ]
                                         |
                                  [ Synced to DB ]
```
