import Foundation
import Observation
import SwiftUI

/// The training block (its overview, session grid and days) and the weekly check-ins, plus the coach
/// actions on them: regenerate the block, leave the coach a note, run this week's check-in.
@MainActor
@Observable
final class PlanStore: AppStore {
    @ObservationIgnored weak var app: AppModel?

    private(set) var meso: MesoOverview?
    /// Newest first.
    private(set) var checkIns: [CheckIn] = []
    /// Set after the first successful load; from then on `meso == nil` means the coach is still
    /// writing the first block.
    private(set) var hasLoaded = false
    private(set) var loadError: String?
    /// The regenerate job this screen started, while it runs.
    private(set) var regenerateJob: Job?

    @ObservationIgnored private var firstBlockWatcher: Task<Void, Never>?
    @ObservationIgnored private var regenerateWatcher: Task<Void, Never>?

    var isRegenerating: Bool { regenerateJob != nil }

    // MARK: Loading

    func load() async {
        guard app?.api != nil else { return }
        do {
            let client = try api
            async let mesoRequest: MesoOverview? = client.get("/api/meso")
            async let checkInsRequest: [CheckIn] = client.get("/api/checkins")
            let (meso, checkIns) = try await (mesoRequest, checkInsRequest)
            withAnimation(Theme.spring) {
                self.meso = meso
                self.checkIns = checkIns
                hasLoaded = true
                loadError = nil
            }
            watchForFirstBlock()
        } catch is CancellationError {
        } catch let error as URLError where error.code == .cancelled {
        } catch {
            if hasLoaded {
                app?.report(error)
            } else {
                loadError = error.localizedDescription
            }
        }
    }

    /// While the first block is being written, checks back every few seconds until it lands.
    private func watchForFirstBlock() {
        guard meso == nil else {
            firstBlockWatcher?.cancel()
            firstBlockWatcher = nil
            return
        }
        guard firstBlockWatcher == nil else { return }
        firstBlockWatcher = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                guard !Task.isCancelled, let self else { return }
                await self.load()
                if self.meso != nil {
                    await self.app?.today.load()
                    return
                }
            }
        }
    }

    // MARK: Coach actions

    /// Queues a new block (it replaces the plan from the next session) and watches the job in the
    /// background. Returns false when the request itself failed.
    func regenerate(note: String?) async -> Bool {
        guard regenerateJob == nil else { return true }
        do {
            let job: Job = try await api.post("/api/meso/regenerate", NoteRequest(note: note))
            withAnimation(Theme.spring) { regenerateJob = job }
            regenerateWatcher = Task { [weak self] in
                await self?.finishRegenerating(job)
            }
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    private func finishRegenerating(_ job: Job) async {
        defer { withAnimation(Theme.spring) { regenerateJob = nil } }
        do {
            let done = try await api.waitForJob(job.id)
            if done.status == .failed {
                app?.show(Toast(message: done.error ?? "The coach couldn't write a new block.", style: .error))
                return
            }
            await load()
            await app?.today.load()
            app?.show(Toast(message: "Your new block is ready.", style: .success))
        } catch {
            app?.report(error)
        }
    }

    /// `POST /api/coach/note`. Returns true when the note was saved.
    func sendNote(_ note: String) async -> Bool {
        do {
            let _: OkResponse = try await api.post("/api/coach/note", NoteRequest(note: note))
            app?.show(Toast(message: "Your coach will see that next time.", style: .success))
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    /// Runs this week's check-in. When it already ran, the server keeps it and only stores the note.
    func runCheckIn(note: String?) async -> Bool {
        let known = Set(checkIns.map(\.id))
        do {
            let checkIn: CheckIn = try await api.post("/api/checkins/run", NoteRequest(note: note))
            withAnimation(Theme.spring) { upsert(checkIn) }
            if known.contains(checkIn.id) {
                app?.show(Toast(message: note == nil ? "This week's check-in already ran." : "Note added to this week's check-in."))
            } else {
                app?.show(Toast(message: Self.checkInToast(checkIn), style: .success))
            }
            // Today clears the "due" state and starts watching the coach-note job; targets may have moved.
            await app?.today.load()
            await app?.refreshState()
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    private func upsert(_ checkIn: CheckIn) {
        if let index = checkIns.firstIndex(where: { $0.id == checkIn.id }) {
            checkIns[index] = checkIn
        } else {
            checkIns.append(checkIn)
            checkIns.sort { ($0.weekStart, $0.id) > ($1.weekStart, $1.id) }
        }
    }

    private static func checkInToast(_ checkIn: CheckIn) -> String {
        let kcal = Int(checkIn.adjustmentKcal.rounded())
        if kcal == 0 { return "Check-in done. Calories stay the same." }
        return "Check-in done. Calories \(Fmt.signed(Double(kcal), decimals: 0)) a day."
    }

    // MARK: Derived

    /// The newest check-in has no coach note yet and one is still plausibly being written.
    func isCoachNotePending(_ checkIn: CheckIn) -> Bool {
        guard checkIn.coachNote == nil, checkIn.id == checkIns.first?.id else { return false }
        if app?.today.data?.pendingJobs.contains(where: { $0.kind == .checkInNote }) == true { return true }
        guard let created = Dates.timestamp(checkIn.createdAt) else { return false }
        return Date.now.timeIntervalSince(created) < 30 * 60
    }

    /// Coach jobs that change what this tab shows.
    var coachJobs: [Job] {
        var jobs = regenerateJob.map { [$0] } ?? []
        let pending = app?.today.data?.pendingJobs ?? []
        for job in pending where (job.kind == .mesocycle || job.kind == .checkInNote) && !jobs.contains(where: { $0.id == job.id }) {
            jobs.append(job)
        }
        return jobs
    }
}
