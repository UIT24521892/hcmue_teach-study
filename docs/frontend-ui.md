# Frontend UI — bản trải nghiệm

## Chạy giao diện

```bash
npm run dev -w @mach/web
```

Mở `http://localhost:5173`. Bản trải nghiệm không cần PostgreSQL, Redis hoặc API key.

## Các trang

| Đường dẫn | Nội dung và thao tác |
|---|---|
| `/` | Dashboard, chỉ số cục bộ, nhịp học bảy ngày và cây tri thức |
| `/documents` | Tìm/lọc tài liệu mẫu; chọn file, kiểm tra loại/dung lượng và lưu metadata |
| `/classes` | Lớp mẫu, tạo lớp nháp; học sinh có form mã lớp báo chưa kết nối API |
| `/classes/:classId` | Bài minh họa, bảng học sinh mẫu cho giáo viên |
| `/practice` | Thư viện bài luyện, lọc Reading/Vocabulary |
| `/practice/:quizId` | Chế độ tập trung, timer, ba dạng câu hỏi, lưu bản nháp và xác nhận nộp |
| `/results/:attemptId` | Điểm demo, đáp án, giải thích, luyện lại hoặc sang ghi chú |
| `/notes` | Chuyển tháng/ngày, giữ bản nháp trong tab, lưu ghi chú, tag, tự đánh giá và cây học tập |
| `/progress` | 7/30 ngày hoạt động, lịch sử kết quả, khu vườn và xem trước mốc trưởng thành |
| `/settings` | Tên hiển thị, mục tiêu tuần, chuyển vai trò xem trước |

Sidebar dùng route thật và đánh dấu trang đang mở. Desktop có chế độ thu gọn được lưu; mobile dùng Radix Dialog để quản lý focus, Escape và ngăn tương tác nền. Hộp tìm kiếm trên header là tìm trang, không giả lập tìm toàn bộ dữ liệu.

## Quy tắc cây và streak trong demo

- Một ghi chú đã lưu trong ngày = một buổi. Sửa cùng ngày không cộng lá.
- Một attempt nộp xong = một buổi; nhiều attempt cùng ngày vẫn chỉ tăng streak một ngày.
- 1 buổi = 1 lá, 10 buổi = 1 cành hoàn chỉnh.
- Mốc 1/10/30/50 buổi: nảy mầm, cây non, vươn cành, vững vàng.
- Mỗi cây vẽ tối đa 100 lá. Sau đó mở cây mới và giữ tổng số cây trưởng thành, tổng lá và cành trong vườn; không âm thầm cắt dữ liệu ở 50 buổi.
- Chuỗi ngày liên tiếp tách khỏi số buổi. Khi hôm nay chưa học, chuỗi tính đến hôm qua vẫn còn. Bỏ một ngày không làm mất lá tích lũy.
- Ngày demo theo timezone thiết bị. Timezone tài khoản và tính streak backend thuộc giai đoạn Daily Notes.

## Giới hạn rõ ràng

- Dữ liệu mẫu được lưu dưới `mach-demo-v1`. Quiz draft dùng `mach-quiz-<id>`; theme/sidebar dùng khóa riêng.
- Note draft chưa lưu được giữ trong `sessionStorage` của tab bằng khóa `mach-note-draft-<date>`, chưa tính buổi học. Đóng tab có thể làm mất bản nháp; bấm Lưu để giữ ghi chú.
- Tài liệu, lớp và lịch sử bài luyện có phân trang cục bộ 6 mục/trang; server-side pagination sẽ nối khi có API.
- Đổi vai trò chỉ thay đổi giao diện. Không phải RBAC và không cách ly dữ liệu người dùng.
- Không lưu mật khẩu/token; không dùng dữ liệu học sinh thật hoặc tài liệu nhạy cảm.
- File mới chỉ lưu tên, loại, dung lượng. Không upload, extract, OCR hoặc sinh câu hỏi; kiểm tra frontend không thay thế kiểm tra MIME phía server.
- Duyệt tài liệu là thay đổi trạng thái mẫu, chưa có trình sửa câu hỏi hoặc xuất bản/giao bài thật.
- Quiz là bộ câu hỏi biên soạn sẵn, chấm client-side để thử trải nghiệm. Hết giờ khóa đáp án và yêu cầu nộp. Không dùng kết quả này cho thi cử.
- Lớp tạo mới là bản nháp, chưa cấp mã mời. Danh sách học sinh chỉ là dữ liệu minh họa.
- Auth/đăng ký/khôi phục mật khẩu, API, job AI, upload thật và lớp thật vẫn nằm trong `PROJECT_PLAN.md`.

## Kiểm thử

```bash
npm run lint
npm run typecheck
npm run test -w @mach/web
npm run build
npm run test:e2e -w @mach/web
```

E2E dùng Google Chrome đã cài trên máy local. Trên CI, cài Chromium bằng `npx playwright install --with-deps chromium`, chạy với `CI=true`. Bộ E2E tự mở Vite ở cổng 5178, cần cổng còn trống và quyền mở browser/server.

E2E kiểm tra desktop 1440px/mobile 390px, các trang ở cả light/dark, không tràn ngang, menu và focus, quiz autosave/submit/hết giờ, file validation, ghi chú và role preview. Ảnh toàn trang nằm trong `frontend/test-results/`; kết quả chạy được ignore khỏi source control.

Kết quả kiểm chứng ngày 17/09/2026: 47 unit/integration tests toàn repo (40 frontend, 5 API, 2 contracts), 20 E2E, lint, typecheck, build và format check đều thành công trên máy local. Worker chưa có test. CI được bổ sung E2E; chưa chạy workflow GitHub trong phiên triển khai UI.

Thiết kế dùng `ui-skills-root` → `ibelick/baseline-ui`, giữ palette giấy ấm/san hô/navy, shared shell, semantic tokens và component chung. Cây là SVG native, không cần ảnh raster hoặc dịch vụ hình ảnh.
