/**
 * ================================================================
 * SMA APP — MASTER ARCHITECTURE / SINGLE SOURCE OF TRUTH
 * ================================================================
 * FILE: SMA_APP_MASTER_ARCHITECTURE.js
 * VERSION: 2.0
 *
 * THIS FILE REPLACES ALL PREVIOUS SMA WORKFLOW / STATUS / BILLING
 * ARCHITECTURE JS DOCUMENTS.
 *
 * DO NOT MERGE THIS FILE WITH OLDER ARCHITECTURE FILES.
 * DO NOT KEEP A SECOND ARCHITECTURE SPEC FOR THE SAME SYSTEM.
 *
 * This single file contains:
 * - Existing-app integration rules
 * - Project status model
 * - Workflow engine
 * - Workflow stages/actions/transitions
 * - Admin vs Client vs System ownership
 * - Explicit Admin Workstream
 * - Explicit Client Workstream
 * - Parallel-development contract
 * - Document lifecycle/versioning
 * - Invoice architecture
 * - Payment/payment-proof lifecycle
 * - Kuitansi/receipt generation
 * - Activity/audit model
 * - Recommended entities/schema
 * - UI integration rules
 * - End-to-end workflow examples
 * - Anti-patterns
 * - Implementation sequence
 * - Claude Code audit instructions
 *
 * IMPORTANT:
 * This is an ARCHITECTURE SPECIFICATION, not runtime application code.
 *
 * EXISTING SMA APP REMAINS THE FOUNDATION.
 * The goal is to EXTEND it, not replace it.
 * ================================================================
 */

const SMA_APP_MASTER_ARCHITECTURE = {

  // ================================================================
  // 1. META / SOURCE OF TRUTH
  // ================================================================

  meta: {
    name: "SMA App — Master Architecture",
    version: "2.0",
    status: "DESIGN_BASELINE",

    purpose:
      "Single implementation reference for SMA App workflow, project status, role ownership, document lifecycle, billing, invoice, payment verification, kuitansi, activity/audit, UI integration, and parallel Admin/Client development.",

    rule:
      "EXTEND_EXISTING_APP",

    replacementRule:
      "This file replaces all previous SMA workflow, status, billing, invoice, payment, receipt, and role-ownership architecture documents."
  },


  sourceOfTruth: {

    readTogether: [
      "SMA_APP_MASTER_ARCHITECTURE.js",
      "SMA App workflow UI draft screenshot",
      "Existing SMA App repository/codebase",
      "Existing PRD/business requirements"
    ],

    priority: [
      "Existing working repository/code",
      "This architecture document",
      "UI draft screenshot",
      "Existing PRD/business requirements"
    ],

    important:
      "The existing repository is the implementation foundation. This architecture defines the new target behavior."
  },


  // ================================================================
  // 2. EXISTING APPLICATION — PRESERVE
  // ================================================================

  existingApp: {

    principle:
      "The existing SMA App must be extended, not replaced.",

    preserve: [
      "Existing application shell",
      "Existing sidebar",
      "Existing top navigation",
      "Existing dark-mode visual system",
      "Existing typography",
      "Existing spacing",
      "Existing reusable components",
      "Existing Client Detail page",
      "Existing routing",
      "Existing authentication",
      "Existing authorization",
      "Existing working functionality",
      "Existing Supabase entities when reusable"
    ],

    existingClientDetailTabs: [
      "Info",
      "Project",
      "Dokumen",
      "Pembayaran",
      "Aktivitas"
    ],

    doNot: [
      "Create a new dashboard instead of extending the existing dashboard",
      "Create a second project system",
      "Create a second payment system",
      "Create a parallel Client Detail page",
      "Replace the existing design system",
      "Duplicate database entities without auditing existing schema",
      "Create separate Admin and Client applications",
      "Throw away working functionality"
    ]
  },


  // ================================================================
  // 3. CORE WORKFLOW MODEL
  // ================================================================

  coreModel: {

    principle:
      "Project status is NOT the entire workflow.",

    stateChain:
      "PROJECT -> CURRENT_STAGE -> CURRENT_ACTION -> CURRENT_OWNER",

    eventChain:
      "EVENT -> RULE/PRECONDITION -> TRANSITION -> NEW_STAGE/ACTION/OWNER -> AUDIT -> NOTIFICATION",

    currentOwnerMeaning:
      "current_owner answers the operational question: WHO HAS THE BALL RIGHT NOW?",

    criticalUXQuestions: [
      "Where is the project right now?",
      "What is the current workflow stage?",
      "Who currently has the ball?",
      "What exact action is required next?",
      "What is blocking the project?",
      "What happens after the action is completed?"
    ]
  },


  // ================================================================
  // 4. PERSONAS
  // ================================================================

  personas: {

    ADMIN: {

      label: "ADMIN / SMA",

      responsibilities: [
        "Create project",
        "Configure workflow",
        "Request information",
        "Request documents",
        "Review submitted documents",
        "Approve documents",
        "Reject documents",
        "Provide rejection reason",
        "Request payment",
        "Review payment proof",
        "Verify payment",
        "Reject payment",
        "Update work progress",
        "Upload completed deliverables",
        "Complete project"
      ]
    },


    CLIENT: {

      label: "CLIENT",

      responsibilities: [
        "View own projects",
        "Upload requested information",
        "Upload requested documents",
        "Upload document revisions",
        "View/download invoice",
        "Make payment",
        "Upload payment proof",
        "View payment verification status",
        "Download official receipt/kuitansi",
        "Download completed deliverables"
      ]
    },


    SYSTEM: {

      label: "SYSTEM",

      responsibilities: [
        "Generate invoice",
        "Generate invoice PDF",
        "Generate receipt/kuitansi",
        "Generate receipt PDF",
        "Evaluate workflow rules",
        "Evaluate preconditions",
        "Create next actions",
        "Execute configured transitions",
        "Record audit events",
        "Send notifications"
      ]
    }
  },


  // ================================================================
  // 5. EXPLICIT ROLE OWNERSHIP MATRIX
  // ================================================================
  //
  // PURPOSE:
  // Make ownership explicit so Admin and Client workstreams
  // can be developed independently and in parallel.
  //
  // IMPORTANT:
  // Admin and Client do NOT have separate business logic.
  // They consume the same workflow state and event contracts.
  // ================================================================

  roleOwnershipMatrix: {

    legend: {
      ADMIN:
        "Admin/SMA can execute this action.",

      CLIENT:
        "Client can execute this action.",

      SYSTEM:
        "System executes automatically.",

      VIEW:
        "Role can view the resulting state/document.",

      NONE:
        "Role cannot execute this action."
    },


    actions: {

      CREATE_PROJECT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      CONFIGURE_WORKFLOW: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      REQUEST_DOCUMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "SYSTEM"
      },

      UPLOAD_DOCUMENT: {
        ADMIN: "NONE",
        CLIENT: "CLIENT",
        SYSTEM: "NONE"
      },

      REVIEW_DOCUMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      APPROVE_DOCUMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      REJECT_DOCUMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      UPLOAD_REVISION: {
        ADMIN: "NONE",
        CLIENT: "CLIENT",
        SYSTEM: "NONE"
      },

      UPDATE_PROJECT_PROGRESS: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      REQUEST_PAYMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "SYSTEM"
      },

      GENERATE_INVOICE: {
        ADMIN: "NONE",
        CLIENT: "VIEW",
        SYSTEM: "SYSTEM"
      },

      DOWNLOAD_INVOICE: {
        ADMIN: "VIEW",
        CLIENT: "VIEW",
        SYSTEM: "NONE"
      },

      MAKE_PAYMENT: {
        ADMIN: "NONE",
        CLIENT: "CLIENT",
        SYSTEM: "NONE"
      },

      UPLOAD_PAYMENT_PROOF: {
        ADMIN: "NONE",
        CLIENT: "CLIENT",
        SYSTEM: "NONE"
      },

      VERIFY_PAYMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      REJECT_PAYMENT: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      GENERATE_RECEIPT: {
        ADMIN: "NONE",
        CLIENT: "VIEW",
        SYSTEM: "SYSTEM"
      },

      DOWNLOAD_RECEIPT: {
        ADMIN: "VIEW",
        CLIENT: "VIEW",
        SYSTEM: "NONE"
      },

      UPLOAD_DELIVERABLE: {
        ADMIN: "ADMIN",
        CLIENT: "NONE",
        SYSTEM: "NONE"
      },

      DOWNLOAD_DELIVERABLE: {
        ADMIN: "VIEW",
        CLIENT: "CLIENT",
        SYSTEM: "NONE"
      },

      COMPLETE_PROJECT: {
        ADMIN: "ADMIN",
        CLIENT: "VIEW",
        SYSTEM: "SYSTEM"
      },

      VIEW_ACTIVITY: {
        ADMIN: "VIEW",
        CLIENT: "VIEW",
        SYSTEM: "NONE"
      }
    }
  },


  // ================================================================
  // 6. STATUS MODEL
  // ================================================================

  statuses: {

    project: [
      "DRAFT",
      "ACTIVE",
      "ON_HOLD",
      "COMPLETED",
      "CANCELLED"
    ],

    stage: [
      "PENDING",
      "IN_PROGRESS",
      "WAITING",
      "BLOCKED",
      "COMPLETED",
      "SKIPPED",
      "CANCELLED"
    ],

    action: [
      "TODO",
      "IN_PROGRESS",
      "WAITING",
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "COMPLETED",
      "CANCELLED"
    ],

    owner: [
      "ADMIN",
      "CLIENT",
      "SYSTEM"
    ],

    document: [
      "REQUESTED",
      "UPLOADED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "REVISION_REQUIRED",
      "REPLACED",
      "ACCEPTED"
    ],

    invoice: [
      "DRAFT",
      "ISSUED",
      "SENT",
      "PARTIALLY_PAID",
      "PAID",
      "OVERDUE",
      "CANCELLED"
    ],

    payment: [
      "NOT_REQUIRED",
      "WAITING_PAYMENT",
      "PAYMENT_PROOF_SUBMITTED",
      "UNDER_VERIFICATION",
      "PAID",
      "REJECTED",
      "REFUNDED"
    ],

    receipt: [
      "NOT_GENERATED",
      "GENERATED",
      "VOIDED"
    ]
  },


  // ================================================================
  // 7. WORKFLOW TEMPLATE + INSTANCE
  // ================================================================

  workflow: {

    template: {

      purpose:
        "Reusable blueprint for a project type.",

      example: [
        "DOCUMENT_COLLECTION",
        "DOCUMENT_VERIFICATION",
        "PROCESSING",
        "PAYMENT",
        "FINAL_DELIVERY"
      ]
    },


    instance: {

      purpose:
        "Project-specific copy of the workflow template.",

      criticalRule:
        "A workflow instance may diverge from its original template.",

      allowedCustomization: [
        "Add stage",
        "Remove stage",
        "Reorder stage",
        "Add action",
        "Remove action",
        "Add required document",
        "Remove required document",
        "Add payment gate",
        "Add approval requirement",
        "Add conditional branch",
        "Add revision loop",
        "Change owner",
        "Change SLA",
        "Change due date",
        "Skip permitted stage"
      ]
    },


    actionTypes: [
      "REQUEST_DOCUMENT",
      "UPLOAD_DOCUMENT",
      "UPLOAD_REVISION",
      "REVIEW_DOCUMENT",
      "APPROVE_DOCUMENT",
      "REJECT_DOCUMENT",
      "REQUEST_PAYMENT",
      "SUBMIT_PAYMENT_PROOF",
      "VERIFY_PAYMENT",
      "UPDATE_PROGRESS",
      "UPLOAD_DELIVERABLE",
      "DOWNLOAD_DELIVERABLE",
      "CONFIRM"
    ],


    preconditions: [
      "All required documents approved",
      "Specific action completed",
      "Specific invoice fully paid",
      "Client confirmation received",
      "Required deliverable exists"
    ]
  },


  // ================================================================
  // 8. ADMIN WORKSTREAM
  // ================================================================
  //
  // This can be assigned to Ray / Claude / Admin-side developer.
  // It can proceed independently from Client workstream.
  // ================================================================

  adminWorkstream: {

    owner:
      "ADMIN / SMA DEVELOPMENT",

    objective:
      "Build the SMA-facing operational side of the workflow.",

    scope: [

      "Admin Dashboard workflow awareness",

      "Project management",

      "Project creation",

      "Workflow configuration",

      "Workflow stage management",

      "Workflow action management",

      "Document request management",

      "Document review",

      "Document approval",

      "Document rejection",

      "Revision reason management",

      "Project progress update",

      "Payment request creation",

      "Invoice request trigger",

      "Payment proof review",

      "Payment verification",

      "Payment rejection",

      "Kuitansi visibility",

      "Deliverable upload",

      "Project completion",

      "Admin activity/audit view"
    ],


    adminDashboard: {

      sections: [
        "Action Required — SMA",
        "Waiting for Client",
        "Payment Pending",
        "In Processing",
        "Completed"
      ]
    },


    adminProjectDetail: {

      sections: [
        "Project Summary",
        "Workflow Progress",
        "Current Responsibility",
        "Current Action",
        "Stage Details",
        "Documents",
        "Billing",
        "Deliverables",
        "Activity Timeline"
      ]
    },


    adminCriticalActions: [
      "Review Document",
      "Approve",
      "Reject",
      "Request Document",
      "Request Payment",
      "Verify Payment",
      "Reject Payment",
      "Upload Deliverable",
      "Complete Project"
    ],


    adminPermissions: [
      "Create project",
      "Configure project workflow",
      "Create document requirements",
      "Review documents",
      "Approve documents",
      "Reject documents",
      "Request payment",
      "Verify payment",
      "Reject payment",
      "Upload deliverables",
      "Update progress",
      "Complete project"
    ],


    adminMustNotOwn: [
      "Client document upload UI",
      "Client revision submission UI",
      "Client payment proof submission UI"
    ]
  },


  // ================================================================
  // 9. CLIENT WORKSTREAM
  // ================================================================
  //
  // This can be assigned to Dimas / Client-side developer.
  // It can proceed independently from Admin workstream.
  // ================================================================

  clientWorkstream: {

    owner:
      "CLIENT-SIDE DEVELOPMENT",

    objective:
      "Build the client-facing experience for actions assigned to CLIENT.",

    scope: [

      "Client Dashboard",

      "Client Project List",

      "Client Project Detail",

      "Current Responsibility display",

      "Client document upload",

      "Client document revision",

      "Client document status",

      "Invoice viewing",

      "Invoice download",

      "Payment instruction",

      "Payment proof submission",

      "Payment verification status",

      "Kuitansi viewing",

      "Kuitansi download",

      "Final deliverable download",

      "Relevant client activity timeline"
    ],


    clientDashboard: {

      sections: [
        "My Projects",
        "Action Required",
        "Waiting for SMA",
        "Payment Required",
        "Processing",
        "Completed"
      ]
    },


    clientProjectDetail: {

      sections: [
        "Project Summary",
        "Workflow Progress",
        "Current Responsibility",
        "Current Action",
        "Required Documents",
        "Billing",
        "Deliverables",
        "Client Activity"
      ]
    },


    clientCriticalActions: [
      "Upload Document",
      "Upload Revision",
      "Download Invoice",
      "Submit Payment Proof",
      "Download Kuitansi",
      "Download Deliverable"
    ],


    clientPermissions: [
      "View own projects",
      "View relevant workflow state",
      "Upload requested documents",
      "Upload document revisions",
      "Download own invoices",
      "Submit payment proof",
      "View payment verification status",
      "Download issued receipts",
      "Download available deliverables"
    ],


    clientMustNotOwn: [
      "Workflow configuration",
      "Document approval",
      "Document rejection",
      "Payment verification",
      "Invoice status mutation",
      "Receipt generation",
      "Project completion"
    ]
  },


  // ================================================================
  // 10. PARALLEL DEVELOPMENT CONTRACT
  // ================================================================

  parallelDevelopment: {

    goal:
      "Admin and Client workstreams can be developed in parallel without waiting for each other's UI implementation.",


    principle:
      "Both sides use the SAME backend/workflow state contract. They do NOT implement separate business logic.",


    sharedFoundation: [

      "Authentication",

      "Authorization",

      "Project entity",

      "Client entity",

      "Workflow instance",

      "Workflow stages",

      "Workflow actions",

      "Current owner",

      "Current action",

      "Action status",

      "Workflow events",

      "Document contract",

      "Invoice contract",

      "Payment contract",

      "Receipt contract",

      "Activity event contract"
    ],


    sharedStateContract: {

      fields: [
        "project_id",
        "workflow_instance_id",
        "current_stage_id",
        "current_action_id",
        "current_owner",
        "action_type",
        "action_status",
        "due_at",
        "blocking_reason",
        "target_type",
        "target_id"
      ]
    },


    adminCanStartImmediately: [
      "Admin workflow dashboard",
      "Project workflow configuration",
      "Admin project workflow view",
      "Document request",
      "Document review",
      "Document approval/rejection",
      "Payment request",
      "Payment verification",
      "Payment rejection",
      "Deliverable upload",
      "Admin activity view"
    ],


    clientCanStartImmediately: [
      "Client dashboard",
      "Client project view",
      "Current responsibility component",
      "Client document upload",
      "Client revision upload",
      "Invoice display",
      "Invoice download",
      "Payment proof submission",
      "Payment verification status",
      "Receipt display/download",
      "Deliverable display/download",
      "Client activity view"
    ],


    doNotWaitForEachOther: [
      "Admin UI does not need Client UI to be completed.",
      "Client UI does not need Admin UI to be completed.",
      "Both sides consume the shared workflow state contract.",
      "Both sides can use mock workflow states during development.",
      "Integration happens through shared data/state contracts, not direct component dependencies."
    ],


    mockStatesForParallelDevelopment: [

      {
        name: "CLIENT_ACTION_REQUIRED",
        currentOwner: "CLIENT",
        currentAction: "UPLOAD_REVISION",
        actionStatus: "TODO"
      },

      {
        name: "ADMIN_ACTION_REQUIRED",
        currentOwner: "ADMIN",
        currentAction: "REVIEW_DOCUMENT",
        actionStatus: "TODO"
      },

      {
        name: "CLIENT_PAYMENT_REQUIRED",
        currentOwner: "CLIENT",
        currentAction: "SUBMIT_PAYMENT_PROOF",
        actionStatus: "TODO"
      },

      {
        name: "ADMIN_PAYMENT_VERIFICATION",
        currentOwner: "ADMIN",
        currentAction: "VERIFY_PAYMENT",
        actionStatus: "UNDER_REVIEW"
      },

      {
        name: "RECEIPT_AVAILABLE",
        currentOwner: "ADMIN",
        currentAction: "NEXT_CONFIGURED_ACTION",
        paymentStatus: "PAID",
        receiptStatus: "GENERATED"
      },

      {
        name: "DELIVERABLE_READY",
        currentOwner: "CLIENT",
        currentAction: "DOWNLOAD_DELIVERABLE",
        actionStatus: "TODO"
      }
    ]
  },


  // ================================================================
  // 11. HANDOFF CONTRACT — ADMIN ↔ CLIENT
  // ================================================================

  handoffContract: {

    principle:
      "Admin and Client communicate through shared workflow state, not direct UI dependencies.",


    stateExamples: [

      {
        scenario: "Admin requests document",

        event:
          "DOCUMENT_REQUESTED",

        currentOwner:
          "CLIENT",

        currentAction:
          "UPLOAD_DOCUMENT",

        clientUI:
          "Action Required — Upload Document",

        adminUI:
          "Waiting for Client"
      },


      {
        scenario: "Client uploads document",

        event:
          "DOCUMENT_UPLOADED",

        currentOwner:
          "ADMIN",

        currentAction:
          "REVIEW_DOCUMENT",

        clientUI:
          "Submitted — Waiting for SMA Review",

        adminUI:
          "Action Required — Review Document"
      },


      {
        scenario: "Admin rejects document",

        event:
          "DOCUMENT_REJECTED",

        currentOwner:
          "CLIENT",

        currentAction:
          "UPLOAD_REVISION",

        clientUI:
          "Revision Required",

        adminUI:
          "Waiting for Client"
      },


      {
        scenario: "Admin approves document",

        event:
          "DOCUMENT_APPROVED",

        currentOwner:
          "ADMIN",

        currentAction:
          "NEXT_CONFIGURED_ACTION",

        clientUI:
          "Processing / Waiting for SMA",

        adminUI:
          "Next Admin Action"
      },


      {
        scenario: "Admin requests payment",

        event:
          "PAYMENT_REQUESTED",

        currentOwner:
          "CLIENT",

        currentAction:
          "SUBMIT_PAYMENT_PROOF",

        clientUI:
          "Payment Required",

        adminUI:
          "Waiting for Client Payment"
      },


      {
        scenario: "Client submits payment proof",

        event:
          "PAYMENT_PROOF_UPLOADED",

        currentOwner:
          "ADMIN",

        currentAction:
          "VERIFY_PAYMENT",

        clientUI:
          "Payment Verification in Progress",

        adminUI:
          "Action Required — Verify Payment"
      },


      {
        scenario: "Admin verifies payment",

        event:
          "PAYMENT_VERIFIED",

        currentOwner:
          "SYSTEM",

        currentAction:
          "GENERATE_RECEIPT",

        clientUI:
          "Payment Received after receipt generation",

        adminUI:
          "Payment Verified"
      },


      {
        scenario: "System generates receipt",

        event:
          "RECEIPT_GENERATED",

        currentOwner:
          "ADMIN",

        currentAction:
          "NEXT_CONFIGURED_ACTION",

        clientUI:
          "Receipt Available",

        adminUI:
          "Receipt Issued"
      },


      {
        scenario: "Admin uploads deliverable",

        event:
          "DELIVERABLE_UPLOADED",

        currentOwner:
          "CLIENT",

        currentAction:
          "DOWNLOAD_DELIVERABLE",

        clientUI:
          "Deliverable Ready",

        adminUI:
          "Delivery Complete / Waiting for Client"
      }
    ]
  },


  // ================================================================
  // 12. WORKFLOW ENGINE
  // ================================================================

  workflowEngine: {

    principle:
      "Workflow state transitions are centralized and role-agnostic.",


    responsibilities: [

      "Create workflow instance",

      "Create stages",

      "Create actions",

      "Evaluate preconditions",

      "Consume events",

      "Evaluate transition rules",

      "Change current owner",

      "Change current action",

      "Change current stage",

      "Create next action",

      "Create audit event",

      "Trigger notification"
    ],


    rule:
      "Admin UI and Client UI consume workflow state. They must not invent independent transition logic."
  },


  // ================================================================
  // 13. WORKFLOW STATE EXAMPLES
  // ================================================================

  stateExamples: {

    documentRequest: {

      initial: {
        owner: "ADMIN",
        action: "REQUEST_DOCUMENT"
      },

      afterRequest: {
        event: "DOCUMENT_REQUESTED",
        owner: "CLIENT",
        action: "UPLOAD_DOCUMENT"
      },

      afterUpload: {
        event: "DOCUMENT_UPLOADED",
        owner: "ADMIN",
        action: "REVIEW_DOCUMENT"
      },

      afterReject: {
        event: "DOCUMENT_REJECTED",
        owner: "CLIENT",
        action: "UPLOAD_REVISION"
      },

      afterApprove: {
        event: "DOCUMENT_APPROVED",
        owner: "ADMIN",
        action: "NEXT_CONFIGURED_ACTION"
      }
    },


    payment: {

      initial: {
        owner: "ADMIN",
        action: "REQUEST_PAYMENT"
      },

      afterRequest: {
        event: "PAYMENT_REQUESTED",
        owner: "SYSTEM",
        action: "GENERATE_INVOICE"
      },

      afterInvoice: {
        event: "INVOICE_GENERATED",
        owner: "CLIENT",
        action: "SUBMIT_PAYMENT_PROOF"
      },

      afterProof: {
        event: "PAYMENT_PROOF_UPLOADED",
        owner: "ADMIN",
        action: "VERIFY_PAYMENT"
      },

      afterVerification: {
        event: "PAYMENT_VERIFIED",
        owner: "SYSTEM",
        action: "GENERATE_RECEIPT"
      },

      afterReceipt: {
        event: "RECEIPT_GENERATED",
        owner: "ADMIN",
        action: "NEXT_CONFIGURED_ACTION"
      }
    }
  },


  // ================================================================
  // 14. DOCUMENT LIFECYCLE
  // ================================================================

  documents: {

    statuses: [
      "REQUESTED",
      "UPLOADED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "REVISION_REQUIRED",
      "REPLACED",
      "ACCEPTED"
    ],


    rules: [

      "Never overwrite submitted document versions.",

      "Every replacement creates a new version.",

      "Rejected document versions remain in history.",

      "Every rejection requires a reason.",

      "Client-submitted documents and SMA-generated deliverables are separate concepts.",

      "Generated invoice and receipt PDFs are immutable document artifacts."
    ],


    example: {

      document:
        "KTP",

      versions: [

        {
          version: 1,
          status: "REJECTED",
          reason: "Document expired"
        },

        {
          version: 2,
          status: "UNDER_REVIEW"
        },

        {
          version: 3,
          status: "APPROVED"
        }
      ]
    }
  },


  // ================================================================
  // 15. BILLING ARCHITECTURE
  // ================================================================

  billing: {

    principle:
      "Invoice, payment, payment proof, verification, and receipt are separate entities and states.",


    relationship:
      "PROJECT -> INVOICE -> PAYMENT -> PAYMENT_PROOF -> ADMIN_VERIFICATION -> RECEIPT",


    invoice: {

      purpose:
        "Formal request for payment.",

      numberFormat:
        "INV-{YEAR}-{SEQUENCE}",

      example:
        "INV-2026-000042",

      fields: [
        "id",
        "project_id",
        "invoice_number",
        "status",
        "issue_date",
        "due_date",
        "currency",
        "subtotal",
        "tax",
        "discount",
        "total",
        "notes",
        "pdf_document_id",
        "created_by",
        "issued_at"
      ]
    },


    invoiceItem: {

      fields: [
        "id",
        "invoice_id",
        "description",
        "quantity",
        "unit_price",
        "amount",
        "term_reference"
      ]
    },


    payment: {

      purpose:
        "Track submitted payment and administrative verification.",

      fields: [
        "id",
        "invoice_id",
        "amount",
        "status",
        "submitted_at",
        "verified_at",
        "verified_by",
        "proof_document_id",
        "rejection_reason",
        "payment_method",
        "reference_number"
      ]
    },


    receipt: {

      purpose:
        "Official SMA acknowledgement of verified payment.",

      numberFormat:
        "KWT-{YEAR}-{SEQUENCE}",

      example:
        "KWT-2026-000042",

      fields: [
        "id",
        "payment_id",
        "receipt_number",
        "status",
        "issued_at",
        "pdf_document_id",
        "issued_by"
      ]
    },


    criticalRules: [

      "Uploading payment proof is NOT equivalent to payment received.",

      "Only ADMIN/SMA verification can make payment PAID.",

      "Receipt/kuitansi can only be generated after verified PAID payment.",

      "If full invoice amount is verified, invoice becomes PAID.",

      "Rejected payment returns to a client-action state and must include a rejection reason.",

      "Issued invoices and receipts must not be silently edited.",

      "Financial document numbering must be backend-controlled.",

      "Receipt generation must be idempotent."
    ],


    lifecycle: [

      "REQUEST_PAYMENT",

      "GENERATE_INVOICE",

      "ISSUE_INVOICE",

      "SEND_INVOICE",

      "CLIENT_MAKES_PAYMENT",

      "CLIENT_SUBMITS_PAYMENT_PROOF",

      "ADMIN_REVIEWS_PAYMENT",

      "PAYMENT_VERIFIED_OR_REJECTED",

      "IF_VERIFIED_GENERATE_RECEIPT",

      "EVALUATE_WORKFLOW_PRECONDITIONS",

      "CONTINUE_WORKFLOW"
    ]
  },


  // ================================================================
  // 16. ACTIVITY / AUDIT
  // ================================================================

  activity: {

    principle:
      "Important workflow and billing events are append-only and auditable.",


    events: [

      "PROJECT_CREATED",

      "STAGE_STARTED",

      "ACTION_CREATED",

      "ACTION_COMPLETED",

      "DOCUMENT_REQUESTED",

      "DOCUMENT_UPLOADED",

      "DOCUMENT_REJECTED",

      "DOCUMENT_APPROVED",

      "DOCUMENT_REPLACED",

      "PAYMENT_REQUESTED",

      "INVOICE_GENERATED",

      "INVOICE_SENT",

      "PAYMENT_PROOF_UPLOADED",

      "PAYMENT_VERIFICATION_STARTED",

      "PAYMENT_REJECTED",

      "PAYMENT_VERIFIED",

      "RECEIPT_GENERATED",

      "DELIVERABLE_UPLOADED",

      "DELIVERABLE_DOWNLOADED",

      "STAGE_COMPLETED",

      "WORKFLOW_TRANSITIONED",

      "PROJECT_COMPLETED"
    ],


    exampleTimeline: [

      "SMA rejected KTP v1 — Document expired",

      "System created revision request",

      "Client uploaded KTP v2",

      "SMA approved KTP v2",

      "Invoice INV-2026-000042 generated",

      "Client submitted payment proof",

      "SMA verified payment",

      "Kuitansi KWT-2026-000042 generated",

      "Workflow moved to Processing"
    ]
  },


  // ================================================================
  // 17. UI INTEGRATION
  // ================================================================

  uiIntegration: {

    principle:
      "Integrate into the existing dark-mode SMA App.",


    projectDetail: [

      "Existing Header",

      "Project Summary",

      "Workflow Progress",

      "Current Responsibility / Current Action",

      "Stage Details",

      "Documents",

      "Billing",

      "Deliverables",

      "Activity Timeline"
    ],


    workflowProgress: {

      requirement:
        "Current stage must be visually dominant.",

      example: [
        "✓ Document Collection",
        "✓ Document Verification",
        "● Revision",
        "○ Processing",
        "○ Payment",
        "○ Final Delivery"
      ]
    },


    currentAction: {

      clientExample: {

        label:
          "CLIENT RESPONSIBILITY",

        title:
          "Upload Revised KTP",

        reason:
          "Previously submitted KTP was rejected because it expired.",

        cta:
          "Upload Revision"
      },


      adminExample: {

        label:
          "SMA RESPONSIBILITY",

        title:
          "Review KTP v2",

        reason:
          "Client uploaded a revised document.",

        cta:
          "Review Document"
      }
    },


    billingUI: {

      show: [
        "Invoice number",
        "Payment term/milestone",
        "Amount",
        "Due date",
        "Invoice status",
        "Payment proof status",
        "Verification status",
        "Receipt number when generated"
      ],

      relationship:
        "Invoice -> Payment -> Proof -> Verification -> Receipt"
    }
  },


  // ================================================================
  // 18. DATABASE / ENTITY MODEL
  // ================================================================

  recommendedEntities: [

    "workflow_templates",

    "workflow_template_stages",

    "workflow_template_actions",

    "workflow_instances",

    "workflow_stages",

    "workflow_actions",

    "workflow_transitions",

    "documents",

    "document_versions",

    "invoices",

    "invoice_items",

    "payments",

    "receipts",

    "activity_events",

    "notifications"
  ],


  databaseRule: {

    critical:
      "Before creating migrations, inspect the existing Supabase schema.",

    rules: [

      "Reuse existing tables when they already represent the same concept.",

      "Extend existing entities when appropriate.",

      "Do not create duplicate parallel entities.",

      "Do not perform destructive migrations before schema audit.",

      "Preserve existing production data.",

      "Use backend-controlled numbering for invoices and receipts.",

      "Use foreign keys and referential integrity.",

      "Use role-based access control/RLS for Admin vs Client data."
    ]
  },


  // ================================================================
  // 19. END-TO-END EXAMPLE
  // ================================================================

  exampleEndToEndScenario: [

    "1. Project is created from a workflow template.",

    "2. System creates a project-specific workflow instance.",

    "3. Admin requests KTP.",

    "4. Client uploads KTP v1.",

    "5. Admin rejects KTP v1 with reason: Document expired.",

    "6. System creates UPLOAD_REVISION action.",

    "7. Current owner becomes CLIENT.",

    "8. Client uploads KTP v2.",

    "9. Current owner becomes ADMIN.",

    "10. Current action becomes REVIEW_DOCUMENT.",

    "11. Admin approves KTP v2.",

    "12. System evaluates required-document preconditions.",

    "13. Workflow moves to the configured next stage.",

    "14. Admin requests Term 2 payment.",

    "15. System generates INV-2026-000042.",

    "16. Client downloads invoice and makes payment.",

    "17. Client uploads payment proof.",

    "18. Payment becomes PAYMENT_PROOF_SUBMITTED.",

    "19. Payment is NOT yet PAID.",

    "20. Admin reviews payment proof.",

    "21. Admin verifies payment.",

    "22. Payment becomes PAID.",

    "23. Invoice becomes PAID if fully settled.",

    "24. System generates KWT-2026-000042.",

    "25. Activity timeline records payment verification.",

    "26. Activity timeline records receipt generation.",

    "27. Workflow evaluates payment preconditions.",

    "28. Workflow continues to the next configured stage.",

    "29. Admin uploads final deliverable.",

    "30. Client downloads final deliverable.",

    "31. Project becomes COMPLETED when configured completion conditions are satisfied."
  ],


  // ================================================================
  // 20. ANTI-PATTERNS
  // ================================================================

  antiPatterns: [

    "Do not create a new dashboard instead of extending the existing dashboard.",

    "Do not create a second project system alongside the existing project system.",

    "Do not create a second payment system alongside the existing payment system.",

    "Do not hardcode workflow by project type.",

    "Do not treat current_owner as project_status.",

    "Do not treat payment proof upload as PAID.",

    "Do not generate a receipt before payment verification.",

    "Do not overwrite document versions.",

    "Do not silently edit issued invoices or receipts.",

    "Do not perform a large destructive database migration before auditing the existing schema.",

    "Do not replace reusable existing UI components.",

    "Do not create separate business logic for Admin and Client.",

    "Do not make Client UI depend directly on Admin UI.",

    "Do not make Admin UI depend directly on Client UI."
  ],


  // ================================================================
  // 21. IMPLEMENTATION SEQUENCE
  // ================================================================

  implementationSequence: [

    {
      phase: 1,

      name:
        "ARCHITECTURE AUDIT",

      actions: [

        "Inspect repository",

        "Inspect frontend architecture",

        "Inspect routing",

        "Inspect Client Detail",

        "Inspect Project",

        "Inspect Documents",

        "Inspect Payments",

        "Inspect Activity",

        "Inspect Supabase schema",

        "Identify existing status fields",

        "Identify reusable components",

        "Map existing entities to this architecture"
      ],

      rule:
        "Do not implement major changes yet. Return audit first."
    },


    {
      phase: 2,

      name:
        "SHARED CONTRACT",

      actions: [

        "Confirm workflow state contract",

        "Confirm current_owner contract",

        "Confirm current_action contract",

        "Confirm document version contract",

        "Confirm invoice/payment/receipt contracts",

        "Confirm activity event contract",

        "Confirm Admin permissions",

        "Confirm Client permissions"
      ]
    },


    {
      phase: 3,

      name:
        "PARALLEL ADMIN + CLIENT DEVELOPMENT",

      actions: [

        "Admin workstream can proceed independently.",

        "Client workstream can proceed independently.",

        "Both consume shared mock states/contracts.",

        "Both use the existing SMA App shell and design system.",

        "Neither creates duplicate business logic."
      ]
    },


    {
      phase: 4,

      name:
        "WORKFLOW ENGINE",

      actions: [

        "Implement workflow instance",

        "Implement stage/action state",

        "Implement transition rules",

        "Implement preconditions",

        "Implement owner changes",

        "Implement event/audit creation"
      ]
    },


    {
      phase: 5,

      name:
        "DOCUMENT WORKFLOW",

      actions: [

        "Document versioning",

        "Document review",

        "Document approval",

        "Document rejection",

        "Revision loop"
      ]
    },


    {
      phase: 6,

      name:
        "BILLING",

      actions: [

        "Payment request",

        "Invoice generation",

        "Invoice PDF",

        "Payment proof",

        "Payment verification",

        "Receipt generation",

        "Receipt PDF"
      ]
    },


    {
      phase: 7,

      name:
        "INTEGRATION",

      actions: [

        "Connect Admin UI",

        "Connect Client UI",

        "Connect workflow engine",

        "Connect billing engine",

        "Connect notifications",

        "Connect activity timeline"
      ]
    },


    {
      phase: 8,

      name:
        "REGRESSION TESTING",

      actions: [

        "Existing functionality",

        "Role permissions",

        "Document revision loop",

        "Payment lifecycle",

        "Receipt generation",

        "Workflow transitions",

        "Responsive UI"
      ]
    }
  ],


  // ================================================================
  // 22. CLAUDE CODE — FIRST TASK
  // ================================================================

  claudeInstructions: {

    instruction:
      "Read this entire SMA_APP_MASTER_ARCHITECTURE.js file and the supplied workflow UI draft screenshot before making implementation decisions.",


    sourceOfTruth:
      "This file replaces all previous workflow/status/billing architecture JS files.",


    firstTask:
      "AUDIT THE EXISTING SMA APP BEFORE IMPLEMENTING.",


    inspect: [

      "Repository structure",

      "Frontend architecture",

      "Routing",

      "Authentication",

      "Authorization",

      "Client Detail",

      "Project",

      "Documents",

      "Payments",

      "Activity",

      "Supabase schema",

      "Existing status fields",

      "Existing reusable UI components"
    ],


    returnAuditContaining: [

      "Current architecture",

      "Existing entities",

      "Existing status mechanisms",

      "Existing Project implementation",

      "Existing Document implementation",

      "Existing Payment implementation",

      "Existing Activity implementation",

      "Existing Supabase tables and relationships",

      "What can be reused",

      "What needs to be extended",

      "What conflicts with this architecture",

      "Required database migrations",

      "Potential breaking changes",

      "Recommended implementation order",

      "How Admin and Client workstreams can be developed in parallel"
    ],


    hardRules: [

      "Do not create a new dashboard.",

      "Do not create a new application shell.",

      "Do not create a parallel project system.",

      "Do not create a parallel payment system.",

      "Do not duplicate existing entities without auditing them.",

      "Do not perform destructive database migrations during the audit.",

      "Do not replace working existing functionality.",

      "Do not implement major features before the audit is reviewed."
    ],


    stopRule:
      "Stop after the audit and wait for confirmation before destructive migrations or major implementation."
  },


  // ================================================================
  // 23. SUCCESS CRITERIA
  // ================================================================

  successCriteria: {

    workflow: [

      "Current stage is obvious.",

      "Current owner is obvious.",

      "Current action is obvious.",

      "Blocking reason is visible.",

      "Next transition is predictable.",

      "Workflow can branch.",

      "Workflow can loop for revision.",

      "Workflow can be customized per project."
    ],


    documents: [

      "Document versions are preserved.",

      "Rejected versions remain visible in history.",

      "Every rejection requires a reason.",

      "Client uploads and SMA deliverables are distinct."
    ],


    billing: [

      "Invoice is separate from payment.",

      "Payment proof is separate from verified payment.",

      "Only Admin verification creates PAID.",

      "Receipt/kuitansi is generated only after verified payment.",

      "Invoice and receipt numbering is backend-controlled.",

      "Financial documents are immutable after issuance."
    ],


    collaboration: [

      "Admin workstream can be developed independently.",

      "Client workstream can be developed independently.",

      "Both use the same workflow state contract.",

      "Neither workstream owns the other's UI.",

      "Neither workstream creates duplicate business logic.",

      "Integration happens through shared state/events/contracts."
    ],


    finalProduct:
      "The final product must feel like the existing SMA App upgraded with a flexible workflow engine and integrated billing system — NOT like a separate prototype."
  }
};


module.exports = SMA_APP_MASTER_ARCHITECTURE;