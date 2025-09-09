# Chat System Application

**Course:** Software Frameworks - 3813ICT  
**Student:** Anam Khan  
**Student Number:** s5350173 

This is a MEAN stack based chat system application, which allows users to communicate
with each other in real-time within different groups
and channels.

---

## Git Repository
the Chat System Application repository has been split into two top level frontend and backend directories. The frontend directory is for the angular client, whilst the backend is for the node/express server. This organisation is to ensure adherence to best MEAN practices through keeping the user interface independant from the server side logic. A gitignore file has been included within the Chat System Application project to help the reposity stay minimal, through exclusion of node_modules, build files, logs and environmental files. Branching will be utilised during development of the project. Specifically, Zahra-branch will be utilised as a working branch and once changes are finalised, they will be merged to the main branch. All commits will be made as early as possible and fequently to ensure a clear reflection of the application's interactive development and progress. 

## Data Structures
The Chat application utilises user, groups, channels, messages models, which will all persist in the LocalStorage for this phase. A user within this application will have an id id, username, email, password, a role and group IDs to which they belong to. A Group will comprise of its own unique id, name, adminIds, who they were createdBy, and a channelId array. Within the ChannelId array, multiple channel IDs can be held depending on how many channels there are within the group. A Channel has a unique id, groupId, name, and a memberId array. The memberId may also hold multiple ids for different members. A ChatMessage includes a unique id, channelId, userId, username, text, and a timestamp. Some additional client-side data is also stored, including the group join/promotion requests (key_register_requests), channel bans (key_bans), ID counters (key_id_counters), and the current session (key_session). There is currently no bannedFrom records within the users model. In the current structure of the application, bans and reports are in seperate lists. However, this data will be moving to mongoDB on the server in phase 2.

## Angular Architecture
The angular client side is organised into the individual components, services, models and routing. Implemented pages/components include the Login, Register, Menu, Groups and Users. The menu contains a general chat and navigation to the other user chat groups. The groups page displays user group membership, channels, allows for join/promote requests to be made and approved, along with user bans. The chat page displays the individual group chats with different channel drop downs. The users page enables users to view and delete their account. Implemented services include the AuthService responsible for login, session, and role checks within the application. StorageService is implemented for all LocalStorage, including seeding, ID counters, requests, bans, reports, and messages. The ChatService is implemented to enable reactive message streams and sending of messages. PermissionsService is a helper responsible for role/admin check for access of different components. Routing has been used to to enable these services to work together to provide client side data storage and reactive chat in phase 1. AuthGuard and RoleGuard are present and can be further utilised in phase 2 to block direct URL access, while the UI already hides and permits actions based on role. The TypeScript models of User, Group, Channel, ChatMessage provide type safety and enhances maintainability.

## Node Server Architecture
Within phase 1, the backend directory only contains minimal express server for ensure health checking. It turns on CORS for http://localhost:4200, reads JSON, and exposes a single GET /api/health endpoint, which verfies that the server is running. Currently theree is no server side databse, authentication persistence or logic. However, in phase 2, the backend will be expended into route files such as auth, users, groups, channels, which will use MongoDB and Socket.io for real time chat functionality.

## Server-Side Routes
In Phase 1 only the GET /api/health is implemented. The application currently does not depend on backend for server side routing. During Phase 2, REST endpoints will be introduced such as POST /api/auth/login enabling authentication. User administration endpoints may also be introduced for listing, promoting, and deleting users. There will also be group and channel creation/deletion endpoints. Additionally, there will be server side role authorisation. These routes will return JSON results and interact with MongoDB for persistence.

## Client–Server Interaction
During phase 1, the application logic and data is within the browser. User validation occurs against the key_users and once validated, sessions are stored in key_session. Any uupdates to groups, channels, membership, requests, bans, or chat messages are updated within the localStorage. the ChatService streams the message list to enable live chat updates. The Express server health endpoint is not a part of the application flow. Within phase 2, the angular client will call Express Api and the server will check user permission, save data in the mongoDB and feature real time push using Socket.io. The browser will just be a display of what the server-side sends.







