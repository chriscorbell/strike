import SwiftUI
import WebKit

/// How to do an exercise: technique video, setup, the rep, and common mistakes.
struct ExerciseGuideSheet: View {
    var store: WorkoutStore
    var exercise: SessionExercise

    @Environment(\.dismiss) private var dismiss
    @State private var detail: ExerciseDetail?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if let detail {
                    ScrollView {
                        content(detail)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 32)
                    }
                    .transition(.opacity)
                } else if let error {
                    LoadErrorView(message: error) { await load() }
                } else {
                    ProgressView()
                        .controlSize(.large)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .animation(Theme.snappy, value: detail)
            .background(Theme.screenBackground)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .task { await load() }
        }
        .presentationDetents([.large])
    }

    private func content(_ detail: ExerciseDetail) -> some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 6) {
                Text(detail.name)
                    .font(.title2.weight(.bold))
                    .fixedSize(horizontal: false, vertical: true)
                Text(musclesLine(detail))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            VideoCard(video: detail.guide.video, exerciseName: detail.name)
            GuideSection(title: "Setup") {
                ForEach(Array(detail.guide.setup.enumerated()), id: \.offset) { _, line in
                    GuideLine(text: line) {
                        Circle()
                            .fill(.tertiary)
                            .frame(width: 6, height: 6)
                    }
                }
            }
            GuideSection(title: "The rep") {
                ForEach(Array(detail.guide.steps.enumerated()), id: \.offset) { index, line in
                    GuideLine(text: line) {
                        Text("\(index + 1)")
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .frame(width: 24, height: 24)
                            .background(Theme.raisedBackground, in: .circle)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            GuideSection(title: "Common mistakes") {
                ForEach(Array(detail.guide.mistakes.enumerated()), id: \.offset) { _, line in
                    GuideLine(text: line) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(Theme.warning)
                    }
                }
            }
        }
    }

    private func musclesLine(_ detail: ExerciseDetail) -> String {
        let also = detail.secondary.map { $0.displayName.lowercased() }.joined(separator: ", ")
        return also.isEmpty ? detail.primary.displayName : "\(detail.primary.displayName) · also \(also)"
    }

    private func load() async {
        error = nil
        do {
            detail = try await store.exerciseDetail(exercise.exerciseId)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct GuideSection<Content: View>: View {
    var title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            content
        }
    }
}

/// One sentence with a leading marker aligned to its first line.
private struct GuideLine<Marker: View>: View {
    var text: String
    @ViewBuilder var marker: Marker

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            marker
                .frame(width: 24)
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 5 }
            Text(text)
                .font(.body)
                .foregroundStyle(.primary.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Video

/// The thumbnail stands in for the player until it's tapped. Closing the sheet tears the player down,
/// which stops playback.
private struct VideoCard: View {
    var video: ExerciseVideo
    var exerciseName: String

    @State private var playing = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Color.black
                .aspectRatio(16 / 9, contentMode: .fit)
                // YouTube requires an embedded player of at least 200 × 200 points.
                .frame(maxWidth: .infinity, minHeight: 200)
                .overlay {
                    if playing {
                        YouTubePlayer(video: video)
                            .transition(.opacity)
                    } else {
                        thumbnail
                    }
                }
                .background(.black)
                .clipShape(.rect(cornerRadius: Theme.smallRadius, style: .continuous))
            .animation(Theme.snappy, value: playing)

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("\(Text(video.channel).foregroundStyle(.secondary)) · \(video.title)")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
                Spacer(minLength: 0)
                Button {
                    openURL(watchURL)
                } label: {
                    Label("YouTube", systemImage: "arrow.up.right")
                        .font(.footnote.weight(.medium))
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Open in YouTube")
            }
        }
    }

    private var thumbnail: some View {
        Button {
            playing = true
        } label: {
            ZStack {
                AsyncImage(url: URL(string: "https://i.ytimg.com/vi/\(video.youtubeId)/hqdefault.jpg")) { image in
                    image
                        .resizable()
                        .scaledToFill()
                        .opacity(0.8)
                } placeholder: {
                    Theme.raisedBackground
                }
                Image(systemName: "play.fill")
                    .font(.title2)
                    .foregroundStyle(.black)
                    .frame(width: 60, height: 60)
                    .background(Color.accentColor, in: .circle)
                    .shadow(color: .black.opacity(0.35), radius: 12, y: 6)
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Text(duration)
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(.black.opacity(0.75), in: .rect(cornerRadius: 6))
                    }
                }
                .padding(10)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Play video: how to do \(exerciseName)")
    }

    /// The video's length, or where it starts when this exercise is partway in.
    private var duration: String {
        func clock(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
        return video.start > 0 ? "From \(clock(video.start))" : clock(video.seconds)
    }

    private var watchURL: URL {
        URL(string: "https://www.youtube.com/watch?v=\(video.youtubeId)\(video.start > 0 ? "&t=\(video.start)s" : "")")!
    }
}

/// YouTube's embedded player in a web view. YouTube rejects embeds without an HTTP Referer (error 153),
/// and asks native apps to identify themselves with `https://<bundle id>`.
private struct YouTubePlayer: UIViewRepresentable {
    var video: ExerciseVideo

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator

        var components = URLComponents(string: "https://www.youtube-nocookie.com/embed/\(video.youtubeId)")!
        components.queryItems = [
            URLQueryItem(name: "autoplay", value: "1"),
            URLQueryItem(name: "playsinline", value: "1"),
            URLQueryItem(name: "rel", value: "0"),
            URLQueryItem(name: "start", value: "\(video.start)"),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue("https://\(Bundle.main.bundleIdentifier ?? "cc.xode.strike")", forHTTPHeaderField: "Referer")
        view.load(request)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.stopLoading()
        view.loadHTMLString("", baseURL: nil)
    }

    /// Keeps the player in place: links out of it (the YouTube logo, "Watch on YouTube") open outside the app.
    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard action.navigationType == .linkActivated, let url = action.request.url else { return .allow }
            await UIApplication.shared.open(url)
            return .cancel
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for action: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = action.request.url { UIApplication.shared.open(url) }
            return nil
        }
    }
}
