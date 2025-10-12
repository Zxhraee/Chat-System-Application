# Chat System Application

**Course:** Software Frameworks - 3813ICT  
**Student:** Anam Khan  
**Student Number:** s5350173 

This is a MEAN stack based chat system application, which allows users to communicate
with each other in real-time within different groups and channels. It utilises angular, node.js and express, providing features such as group management, user promotion, banning, and user chat. It offers server persistence using MongoDB and Socket.IO.

## Git Repository
The Chat System Application is set up with two main folders — frontend and backend.

The frontend holds all the Angular code that users see and interact with. It controls how the app looks, handles navigation, and talks to the backend through API calls. The backend runs on Node.js and Express, connecting to MongoDB to manage the data, logic, and real-time chat using Socket.IO. This setup keeps the design and logic separate, which is a good practice for MEAN stack projects because it makes everything easier to manage and update.
A .gitignore file is included to keep the project clean by ignoring files that don’t need to be shared, like node_modules, build folders, logs, and environment files.

For development, the Zahra-branch is used as the working branch where changes are made. Once those changes are tested and working, they’re merged into the main branch. Commits are made often so there’s a clear record of progress and updates throughout development.

The frontend folder includes all the main parts of the user experience — pages like Login, Register, Menu, Groups, Chat, and Users. It also has important services like AuthService, ChatService, and StorageService, which handle things such as logging in, sending and receiving chat messages, and storing user data. The PermissionsService helps control what users can do based on their role — whether they’re a SUPER_ADMIN, GROUP_ADMIN, or a regular USER.
The data in the app is structured through models like User, Group, Channel, and Message, which make it easier to keep everything organised and consistent. Routing lets users move smoothly between pages, and the environment files manage the connection between the frontend and backend servers.

The backend folder is where the Express server and MongoDB database are set up. It has separate route files for users, groups, channels, and messages, and uses Socket.IO to handle live chat updates. The main server setup happens in server.js, which connects everything and runs the app. Environment variables like the database URL and server port are kept in the .env file to keep sensitive information secure and make setup easier.

## Angular Architecture
The Angular client is organised into different parts including components, services, models, and routing, which all working together to create a smooth and responsive chat experience. The main pages include Login, Register, Menu, Groups, Chat, and Users. Each page has its own purpose within the app.

The Login and Register pages handle user authentication and account creation. The Menu page acts as a central hub that includes a general chat and provides navigation to other group chats. The Groups page lets users see which groups they are a part of, view available channels, send or approve join and promotion requests, and manage bans. The Chat page displays live conversations for each group, with a dropdown to switch between different channels. The Users page allows users to view and delete their accounts.

Several key services help manage the functionality of the application. The AuthService handles user login, registration, and role checking throughout the app. The ChatService connects the frontend to the backend through HTTP and Socket.IO, enabling real-time message updates and communication. The StorageService manages all data stored locally on the client, including things like ID counters, requests, bans, reports, and messages. The PermissionsService is used to check user roles and permissions to control what actions and pages different users can access.

Routing in the application allows users to move between pages seamlessly. The root path leads to the Menu page, while other routes such as /login, /register, /groups, and /chat/:groupId/:channelName direct users to their respective components. Guards such as AuthGuard and RoleGuard are also implemented to prevent unauthorized access. While the user interface already hides and shows features based on the user’s role, these guards can be expanded in later phases to provide additional security.

The Angular models: User, Group, Channel, and Message defines how data is structured across the app, ensuring consistency and reliability. Overall, this structure helps the client side run efficiently, stay organized, and communicate smoothly with the backend in real time.

## Node Server Architecture
The backend of the Chat System Application is built with Node.js, Express, and MongoDB, using Socket.IO to handle real-time chat features. It connects directly to the MongoDB database, which now stores all user, group, channel, and message data instead of relying on LocalStorage like in the earlier phase of development.

The server is organised into multiple route files that handle different parts of the application. These include routes for authentication, users, groups, channels, and messages. Each route is responsible for specific functions such as registering and logging in users, creating and managing groups and channels, sending and receiving chat messages, and performing administrative actions like promoting users or banning members. The backend has CORS enabled to allow communication with the Angular frontend running on http://localhost:4200, and all data is exchanged in JSON format.

All of the data used by the app is stored in MongoDB collections that match the structures used on the frontend. The server automatically converts ObjectId values to strings when sending data to the client so that relationships between documents remain consistent. The main collections include users, groups, channels, messages, bans, and reports. Each document in these collections reflects the same entities that exist in the frontend models but also includes an _id field used for indexing and managing relationships.

The server setup in the server.js file handles Express configuration, connects to the MongoDB database, and sets up Socket.IO for real-time communication between users. The .env file is used to store environment variables such as the database connection string and server port, which helps keep sensitive information secure and makes deployment more flexible.

## Server-Side Routes
In the Chat System Application, the backend includes several REST API routes that connect the Angular frontend to the Node.js and MongoDB server. These routes allow the client to perform key operations such as user authentication, group and channel management, and real-time messaging. Each route is designed to handle a specific part of the system while ensuring data is transferred securely in JSON format.

The authentication routes manage user login and registration. For example, the POST /api/auth/login route allows users to log in by sending their username and password, and in return, the server responds with a token and user details. The POST /api/users route is used to register new users, while GET /api/users retrieves all registered users. The PATCH /api/users/:id route lets administrators update user information such as role, username, or email.

The group and channel routes handle everything related to communication spaces. The POST /api/groups route creates a new group, and GET /api/groups retrieves all groups in the system. Similarly, the POST /api/channels route allows new channels to be created under specific groups, and GET /api/channels returns the list of channels within a selected group.
For messaging, the POST /api/messages route is used when a user sends a message to a channel, and GET /api/messages retrieves all messages for that channel so users can view the ongoing conversation.

All these routes return JSON responses and are managed with Express middleware to handle data validation and CORS, allowing the frontend to communicate with the backend safely. The GET /api/health endpoint remains available as a simple way to check if the server is running properly. Together, these endpoints make up the backbone of the system’s communication between client and server, with MongoDB handling persistent data storage for users, groups, channels, and messages.

## Data Structures
The Chat System Application uses several main data models: User, Group, Channel, and Message which are shared between the frontend and backend to keep data consistent. On the Angular side, these models help structure the information shown in the app and ensure type safety. On the backend, MongoDB stores the same entities but in BSON format with unique _id  fields that define relationships between collections.

A User has a unique _id, along with a username, email, password, and role (which can be SUPER_ADMIN, GROUP_ADMIN, or USER). Each user also has a list of group IDs showing which groups they belong to.
A Group includes a unique _id, name, ownerId, and lists of adminIds and memberIds that track who manages and who belongs to the group.

A Channel belongs to a group and includes its own _id, the groupId it’s linked to, the name of the channel, and the memberIds of the users who can access it.

A Message includes a unique _id, the channelId where it was sent, the senderId and username of the sender, the message text, and a createdAt timestamp.

Additional collections like bans and reports exist to store moderation data, helping manage which users are restricted or have been reported. This structure allows the backend to handle user interactions, group organization, and chat communication efficiently while keeping everything consistent across the database and client.

## REST API Routes
The Chat System Application uses a RESTful API built with Express and MongoDB. These routes allow the Angular frontend to communicate with the backend to handle features such as authentication, group and channel management, and real-time messaging.

All routes send and receive data in JSON format and use middleware for validation and CORS to ensure secure and consistent communication between the client and the server.

| **Method** | **Route**         | **Parameters**                  | **Response**     | **Purpose**              |
| ---------- | ----------------- | ------------------------------- | -----------------| -------------------------|
| **GET**    | `/api/health`     | —                               | `{ status: "ok" }` | Checks if the server is running      |
| **POST**   | `/api/auth/login` | `{ username, password }`        | `{ token, user }`  | Logs a user in                       |
| **POST**   | `/api/users`      | `{ username, email, password }` | `{ user }`         | Registers a new user                 |
| **GET**    | `/api/users`      | —                               | `[users]`          | Lists all users                      |
| **PATCH**  | `/api/users/:id`  | `{ role, username, email }`     | `{ updatedUser }`  | Updates user details                 |
| **POST**   | `/api/groups`     | `{ name, ownerId }`             | `{ group }`        | Creates a new group                  |
| **GET**    | `/api/groups`     | —                               | `[groups]`         | Returns all groups                   |
| **POST**   | `/api/channels`   | `{ name, groupId }`             | `{ channel }`      | Creates a new channel inside a group |
| **GET**    | `/api/channels`   | `?groupId=<id>`                 | `[channels]`       | Lists channels for a specific group  |
| **POST**   | `/api/messages`   | `{ channelId, senderId, text }` | `{ message }`      | Sends a new message                  |
| **GET**    | `/api/messages`   | `?channelId=<id>`               | `[messages]`       | Gets all messages from a channel     |


## Client–Server Interaction
In the current version of the Chat System Application, the frontend and backend now work together instead of everything running just in the browser like before. In the earlier phase, all data such as users, groups, and messages were stored in LocalStorage, and the app used that data directly. Now, in this version, the Angular frontend talks to the Node.js and Express backend, which connects to MongoDB to save and manage all data properly.

When a user logs in, the Angular app sends a request to the backend through the API. The server checks if the user exists and if their details are correct. Once verified, the user is logged in, and their data is stored in the database instead of just in the browser. When a user creates a group or channel, sends a message, or joins a group, the Angular client sends that information to the server, which then saves it in MongoDB and updates everyone’s view in real time.

Messages are now handled using Socket.IO, which means when someone sends a message, it appears instantly for all other users in the same channel without needing to refresh. Here’s how it works: the Angular ChatService sends the message to the server, the server saves it in the messages collection in MongoDB, then the server sends it back out to everyone connected to that channel using a Socket.IO event. The ChatService on the frontend receives this event and updates the chat screen automatically so the message appears right away.

The browser now acts mostly as the display, while the backend performes tasks such as check permissions, saves data, and makes sure everything stays synced in real time.


## Testing Setup

The Chat System Application was tested using Angular’s built-in testing tools for both unit and end-to-end (E2E) testing.
Unit and Coverage Testing

Unit tests were written using Jasmine and Karma to check that each component and service works correctly.
The command below runs all tests: 'ng test'

To generate a coverage report showing how much of the code is tested: ng test --code-coverage

After running this, a coverage folder is created with an index.html file that displays the coverage percentage for statements, functions, and branches.


E2E testing was done using Cypress and the Angular CLI command: ng e2e

This runs full application tests to make sure the user flow—such as login, group creation, and messaging—works correctly from start to finish.

The backend API routes were tested with Mocha using: npm test

This checks that all endpoints respond correctly and data is saved and retrieved properly from MongoDB.