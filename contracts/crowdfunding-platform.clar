;; Decentralized Crowdfunding Platform
;; A simple crowdfunding contract where campaigns can be created, funded, and completed

;; Error constants
(define-constant ERR_NOT_FOUND (err u404))
(define-constant ERR_UNAUTHORIZED (err u401))
(define-constant ERR_CAMPAIGN_ENDED (err u400))
(define-constant ERR_CAMPAIGN_ACTIVE (err u402))
(define-constant ERR_GOAL_NOT_MET (err u403))
(define-constant ERR_ALREADY_CLAIMED (err u405))
(define-constant ERR_INVALID_AMOUNT (err u406))
(define-constant ERR_CAMPAIGN_NOT_ENDED (err u407))

;; Data structures
(define-map campaigns
  { campaign-id: uint }
  {
    creator: principal,
    title: (string-ascii 100),
    description: (string-ascii 500),
    goal: uint,
    raised: uint,
    deadline: uint,
    completed: bool,
    funds-claimed: bool
  }
)

(define-map contributions
  { campaign-id: uint, contributor: principal }
  { amount: uint }
)

(define-map campaign-contributors
  { campaign-id: uint }
  { contributors: (list 100 principal) }
)

;; Global variables
(define-data-var next-campaign-id uint u1)
(define-data-var contract-owner principal tx-sender)

;; Helper functions
(define-private (get-current-block-height)
  stacks-block-height
)

;; Create a new crowdfunding campaign
(define-public (create-campaign (title (string-ascii 100)) (description (string-ascii 500)) (goal uint) (duration uint))
      (let
    (
      (campaign-id (var-get next-campaign-id))
      (deadline (+ (get-current-block-height) duration))
    )
    (asserts! (> goal u0) ERR_INVALID_AMOUNT)
    (asserts! (> duration u0) ERR_INVALID_AMOUNT)
    
    (map-set campaigns
      { campaign-id: campaign-id }
      {
        creator: tx-sender,
        title: title,
        description: description,
        goal: goal,
        raised: u0,
        deadline: deadline,
        completed: false,
        funds-claimed: false
      }
    )
    
    (map-set campaign-contributors
      { campaign-id: campaign-id }
      { contributors: (list) }
    )
    
    (var-set next-campaign-id (+ campaign-id u1))
    (ok campaign-id)
  )
)

;; Contribute to a campaign
(define-public (contribute (campaign-id uint) (amount uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns { campaign-id: campaign-id }) ERR_NOT_FOUND))
      (current-contribution (default-to { amount: u0 } (map-get? contributions { campaign-id: campaign-id, contributor: tx-sender })))
      (current-contributors (get contributors (default-to { contributors: (list) } (map-get? campaign-contributors { campaign-id: campaign-id }))))
    )
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (< (get-current-block-height) (get deadline campaign)) ERR_CAMPAIGN_ENDED)
    (asserts! (not (get completed campaign)) ERR_CAMPAIGN_ENDED)
    
    ;; Transfer STX to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    ;; Update contribution
    (map-set contributions
      { campaign-id: campaign-id, contributor: tx-sender }
      { amount: (+ (get amount current-contribution) amount) }
    )
    
    ;; Add contributor to list if not already present
    (if (is-none (index-of current-contributors tx-sender))
      (map-set campaign-contributors
        { campaign-id: campaign-id }
        { contributors: (unwrap! (as-max-len? (append current-contributors tx-sender) u100) ERR_INVALID_AMOUNT) }
      )
      true
    )
    
    ;; Update campaign raised amount
    (map-set campaigns
      { campaign-id: campaign-id }
      (merge campaign { raised: (+ (get raised campaign) amount) })
    )
    
    (ok true)
  )
)

;; Complete campaign and claim funds (only creator can call this)
(define-public (complete-campaign (campaign-id uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns { campaign-id: campaign-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-eq tx-sender (get creator campaign)) ERR_UNAUTHORIZED)
    (asserts! (>= (get-current-block-height) (get deadline campaign)) ERR_CAMPAIGN_NOT_ENDED)
    (asserts! (>= (get raised campaign) (get goal campaign)) ERR_GOAL_NOT_MET)
    (asserts! (not (get funds-claimed campaign)) ERR_ALREADY_CLAIMED)
    
    ;; Transfer funds to creator
    (try! (as-contract (stx-transfer? (get raised campaign) tx-sender (get creator campaign))))
    
    ;; Mark campaign as completed and funds claimed
    (map-set campaigns
      { campaign-id: campaign-id }
      (merge campaign { completed: true, funds-claimed: true })
    )
    
    (ok true)
  )
)

;; Refund contributors if campaign failed
(define-public (refund-contribution (campaign-id uint))
  (let
    (
      (campaign (unwrap! (map-get? campaigns { campaign-id: campaign-id }) ERR_NOT_FOUND))
      (contribution (unwrap! (map-get? contributions { campaign-id: campaign-id, contributor: tx-sender }) ERR_NOT_FOUND))
    )
    (asserts! (>= (get-current-block-height) (get deadline campaign)) ERR_CAMPAIGN_ACTIVE)
    (asserts! (< (get raised campaign) (get goal campaign)) ERR_GOAL_NOT_MET)
    (asserts! (> (get amount contribution) u0) ERR_INVALID_AMOUNT)
    
    ;; Transfer refund to contributor
    (try! (as-contract (stx-transfer? (get amount contribution) tx-sender tx-sender)))
    
    ;; Remove contribution
    (map-delete contributions { campaign-id: campaign-id, contributor: tx-sender })
    
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-campaign (campaign-id uint))
  (map-get? campaigns { campaign-id: campaign-id })
)

(define-read-only (get-contribution (campaign-id uint) (contributor principal))
  (map-get? contributions { campaign-id: campaign-id, contributor: contributor })
)

(define-read-only (get-campaign-contributors (campaign-id uint))
  (map-get? campaign-contributors { campaign-id: campaign-id })
)

(define-read-only (get-next-campaign-id)
  (var-get next-campaign-id)
)

(define-read-only (is-campaign-successful (campaign-id uint))
  (match (map-get? campaigns { campaign-id: campaign-id })
    campaign (>= (get raised campaign) (get goal campaign))
    false
  )
)

(define-read-only (is-campaign-ended (campaign-id uint))
  (match (map-get? campaigns { campaign-id: campaign-id })
    campaign (>= (get-current-block-height) (get deadline campaign))
    false
  )
)