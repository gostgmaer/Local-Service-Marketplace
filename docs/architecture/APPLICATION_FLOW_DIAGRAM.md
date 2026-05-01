# Application Flow Diagram

This document describes the end-to-end flows of the Local Service Marketplace platform using Mermaid diagrams.

---

## 1. Customer Journey

```mermaid
flowchart TD
    A([Visit Platform]) --> B{Authenticated?}
    B -- No --> C[Register / Login]
    C --> D[Email / Phone / OAuth]
    D --> E{OAuth New User?}
    E -- Yes --> F[Role Selection UI\ncustomer or provider]
    E -- No --> G[Dashboard]
    F --> G
    B -- Yes --> G

    G --> H[Browse Providers\nor Post a Request]

    H --> I[Post Service Request]
    I --> I1[Select Category]
    I1 --> I2[Describe Need + Budget + Urgency]
    I2 --> I3[Set Location]
    I3 --> I4[Request Published]

    I4 --> J[Providers Submit Proposals]
    J --> K[Customer Reviews Proposals]
    K --> L{Accept Proposal?}
    L -- Yes --> M[Job Created Automatically]
    L -- No --> K

    M --> N[Provider Starts Job]
    N --> O[Provider Marks Complete]
    O --> P[Customer Confirms Completion]
    P --> Q[Payment Released to Provider]
    Q --> R[Customer Leaves Review]
    R --> S([Journey Complete])
```

---

## 2. Provider Journey

```mermaid
flowchart TD
    A([Register as Provider]) --> B[Email / Phone / OAuth\nwith role = provider]
    B --> C[Email Verification]
    C --> D[Onboarding Flow]

    D --> D1[Create Provider Profile\nbusiness name, description]
    D1 --> D2[Upload Documents\nAadhaar, certifications]
    D2 --> D3[Select Service Categories]
    D3 --> D4[Set Availability Schedule]
    D4 --> D5[Admin Reviews & Verifies]
    D5 --> E[Provider Dashboard]

    E --> F[Browse Open Requests]
    F --> G[Submit Proposal\nprice + message + timeline]
    G --> H{Customer Accepts?}
    H -- No --> F
    H -- Yes --> I[Job Created]

    I --> J[Start Job]
    J --> K[Deliver Service]
    K --> L[Mark Job Complete]
    L --> M[Customer Confirms]
    M --> N[Earnings Credited]
    N --> O[Receive Review]
    O --> P([Journey Complete])

    E --> Q[Manage Portfolio\nupload work photos]
    E --> R[View Earnings\nactive + pending payout]
```

---

## 3. Authentication Flows

```mermaid
flowchart TD
    A([User Visits Login / Register]) --> B{Auth Method}

    B -- Email/Password --> C[POST /user/auth/register\nor /user/auth/login]
    C --> D{Step}
    D -- Register --> E[Verify Email\nclick link in inbox]
    D -- Login --> F{2FA Enabled?}
    F -- Yes --> G[2FA Challenge\nTOTP or SMS]
    F -- No --> H[JWT Issued]
    G --> H
    E --> H

    B -- Phone OTP --> I[POST /user/auth/send-otp]
    I --> J[Enter 6-digit OTP]
    J --> H

    B -- Magic Link --> K[POST /user/auth/magic-link]
    K --> L[Click link in email]
    L --> H

    B -- Google / Facebook / Apple --> M[OAuth Provider Redirect]
    M --> N[Callback to identity-service]
    N --> O{New User?}
    O -- Yes --> P[Role Selection UI\ncustomer or provider]
    P --> Q{Email provided?}
    Q -- No --> R[Email Input Form]
    Q -- Yes --> S[POST /user/auth/oauth/set-role]
    R --> S
    S --> H
    O -- No --> T[Issue OAuth Code → Redis TTL 60s]
    T --> U[Frontend: POST /user/auth/oauth/exchange]
    U --> H

    H --> V[Access Token 15min\n+ Refresh Token 90d]
    V --> W[Set httpOnly cookies\n+ localStorage fallback]
```

---

## 4. Payment Flow

```mermaid
flowchart TD
    A([Job Confirmed Complete]) --> B[Customer Initiates Payment]
    B --> C{Payment Method}

    C -- Online --> D[Create Payment Order\nRazorpay / Stripe]
    D --> E[Customer Completes on\nPayment Gateway UI]
    E --> F[Webhook: payment.captured]
    F --> G[payment-service processes webhook]
    G --> H[Payment Status = completed]

    C -- Cash --> I[Provider Confirms Cash\nPOST /payments/cash-confirm]
    I --> H

    H --> J[Marketplace Fee Deducted]
    J --> K[Provider Earnings Credited\nto provider balance]
    K --> L[Payout on Schedule\nor on demand]

    B --> M{Coupon Applied?}
    M -- Yes --> N[Validate Coupon\ncheck usage limits + expiry]
    N --> O{Valid?}
    O -- Yes --> P[Apply Discount to Total]
    O -- No --> Q[Show Error]
    P --> D
```

---

## 5. Real-Time (Socket.IO) Event Flow

```mermaid
sequenceDiagram
    participant Client as Frontend (Next.js)
    participant GW as API Gateway
    participant SVC as Backend Service
    participant Socket as Socket.IO Server
    participant Redis as Redis Pub/Sub

    Client->>GW: WebSocket connect (JWT auth)
    GW->>Socket: Authenticate + join rooms

    Note over SVC,Redis: Service emits event after state change
    SVC->>Redis: PUBLISH event (e.g. proposal:created)
    Redis->>Socket: Subscriber receives event
    Socket->>Client: Emit to room (user:{userId})

    Note over Client: React Query invalidated
    Client->>GW: Refetch data (REST)
    GW->>SVC: GET /proposals
    SVC->>Client: Updated data
```

---

## 6. Request Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> open : Customer posts request
    open --> proposal_received : Provider submits proposal
    proposal_received --> open : All proposals rejected
    proposal_received --> in_progress : Customer accepts proposal → Job created
    in_progress --> completed : Job confirmed by customer
    in_progress --> cancelled : Customer or Provider cancels
    open --> cancelled : Customer cancels
    completed --> [*]
    cancelled --> [*]
```

---

## 7. Job Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> pending : Created from accepted proposal
    pending --> scheduled : Provider confirms schedule
    scheduled --> in_progress : Provider starts job
    in_progress --> completed : Customer confirms completion
    in_progress --> disputed : Either party raises dispute
    disputed --> completed : Dispute resolved in favour of completion
    disputed --> cancelled : Dispute resolved as cancellation
    pending --> cancelled : Cancelled before start
    scheduled --> cancelled : Cancelled before start
    completed --> [*]
    cancelled --> [*]
```

---

## 8. Admin & Oversight Flow

```mermaid
flowchart TD
    A([Admin Login]) --> B[Oversight Dashboard]

    B --> C[Manage Users\nsuspend / activate]
    B --> D[Manage Providers\nverify / approve docs / reject]
    B --> E[Manage Categories\ncreate / edit / delete]
    B --> F[Manage Disputes\nreview + resolve]
    B --> G[View Analytics\ndaily metrics + audit logs]
    B --> H[System Settings\nfeature flags + config]

    D --> D1[Review Aadhaar]
    D --> D2[Review Certifications]
    D1 --> D3{Approve?}
    D2 --> D3
    D3 -- Yes --> D4[Provider Verified Badge]
    D3 -- No --> D5[Rejection with Reason\nnotification sent]

    F --> F1[Customer or Provider\nfiles dispute]
    F1 --> F2[Admin Reviews Evidence\nphotos + messages]
    F2 --> F3{Decision}
    F3 -- Refund --> F4[Initiate Refund via payment-service]
    F3 -- Release Payment --> F5[Release to Provider]
    F3 -- Partial --> F6[Split Resolution]
```

---

## 9. Notification Flow

```mermaid
flowchart LR
    A[Domain Event\ne.g. proposal:accepted] --> B[comms-service]
    B --> C{Delivery Channels}
    C --> D[In-App Notification\nstored in DB]
    C --> E[Push Notification\nvia FCM / APNs]
    C --> F[Email\nvia email-service SMTP]
    C --> G[SMS\nvia sms-service]

    D --> H[Frontend polls\nor receives via Socket.IO]
    E --> I[Device notification]
    F --> J[User inbox]
    G --> K[User phone]
```

---

## 10. Service Architecture Overview

```mermaid
graph TB
    FE[Frontend\nNext.js :3000]
    GW[API Gateway\nNestJS :3700]
    ID[identity-service\n:3001]
    MK[marketplace-service\n:3003]
    PM[payment-service\n:3006]
    CM[comms-service\n:3007]
    OV[oversight-service\n:3010]
    IF[infrastructure-service\n:3012]
    PG[(PostgreSQL)]
    RD[(Redis)]
    KF[(Kafka)]

    FE --> GW
    GW --> ID
    GW --> MK
    GW --> PM
    GW --> CM
    GW --> OV
    GW --> IF

    ID --> PG
    MK --> PG
    PM --> PG
    CM --> PG
    OV --> PG
    IF --> PG

    ID --> RD
    MK --> RD
    CM --> RD
    IF --> RD

    ID -.->|events| KF
    MK -.->|events| KF
    PM -.->|events| KF
    CM -.->|consumes| KF
```
