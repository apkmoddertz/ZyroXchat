# Firestore Security Rules Specification (Security TDD)

## 1. Data Invariants
- **User Integrity**: A user profile document ID must equal the user's authenticated `uid`. The `publicKey` must be present and immutable after registration.
- **Channel Membership Gate**: A user cannot read, create, or receive a message inside `/channels/{channelId}` without having a membership confirmation inside `/channels/{channelId}/members/{userId}`.
- **Message Content Security**: Messages must be marked as `isEncrypted == true`. The message `senderId` must strictly match the writer's authenticated `uid`. The `recipientKeys` field must contain the encrypted AES key map.
- **Temporal Invariant**: The `createdAt` on messages must strictly match the request server timestamp (`request.time`).

## 2. The "Dirty Dozen" Malicious Payloads
Here are the 12 payloads representing attacks that the Firestore security rules must block:
1. **Unsigned-In Write**: Attempt to create/update a user profile when `request.auth` is null.
2. **Identity Spoofing**: Attempt to create a user profile with ID `User_B` while signed in as `User_A`.
3. **Owner Field Poisoning**: Attempt to create a channel claiming `createdBy` is `User_B` while signed in as `User_A`.
4. **Member Spy Read**: Attempt to read messages in channel `Channel_X` without being a member of `Channel_X`.
5. **No Key-Exchange Enclosure**: Attempt to post an unencrypted message or a message lacking `recipientKeys`.
6. **Sender Impersonation**: Attempt to create a message with `senderId: "User_B"` while signed in as `User_A`.
7. **Bypass Member Check to Send**: Attempt to send a message to a channel where the user is NOT in the `/members` subcollection.
8. **Malicious ID Poisoning**: Trying to create a channel with a junk 2KB ID to consume firebase resources.
9. **Timestamp Falsification**: Attempt to submit a message with a custom backdated client timestamp.
10. **Membership Escalation**: Attempt to force-join a private DM/Group channel without proper permission.
11. **Shadow Key Inject**: Attempt to update a message to replace the encrypted key Map.
12. **Malicious Message Altering**: Attempt to write/update/overwrite existing messages send by another user.

## 3. Test Runner (Draft Rules)
The draft rules will be fully defined in `DRAFT_firestore.rules` and checked for vulnerability coverage before deploying.
