# eHVPG Calculator

혈청 지표(INR, Albumin, Sodium, Platelet, Total Bilirubin)를 이용해
간정맥압력차(HVPG, Hepatic Venous Pressure Gradient)를 추정하는 정적 웹 계산기입니다.

> ⚠️ **연구·교육 목적 전용.** 실제 임상 진단·치료 결정에 단독으로 사용하지 마십시오.
> HVPG의 표준 측정은 침습적 카테터 검사이며, 본 추정값은 이를 대체하지 않습니다.

## Model Equation

```
PRESS = 37.31 + 5.63·INR − 2.56·Albumin − 0.16·Sodium
        − 12.31·Platelet(×10⁻⁶/µL) + 0.48·Total Bilirubin
```

결과 단위는 mmHg-equivalent. 임상적으로 유의한 문맥압항진증(CSPH)의
통상 기준은 HVPG ≥ 10 mmHg.

## 입력 단위

| 변수 | 단위 | 비고 |
|---|---|---|
| INR | dimensionless | 일반 범위 0.8–3.0 |
| Albumin | g/dL | |
| Sodium (Na) | mmol/L | |
| Platelet | ×10³/µL (= ×10⁹/L) | 예: 139,000/µL → `139` 입력. 모델 변수는 입력값 × 10⁻³ |
| Total Bilirubin | mg/dL | |

## 실행

빌드 과정이 없는 순수 정적 사이트입니다.

```bash
# 로컬 미리보기
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 배포 (GitHub Pages)

1. 이 저장소를 GitHub에 push
2. **Settings → Pages → Build and deployment → Source: `Deploy from a branch`**
3. Branch: `main` / `/ (root)` 선택 후 저장
4. 잠시 후 `https://<user>.github.io/eHVPG_Calculator/` 에서 접속 가능

## 파일 구조

```
eHVPG_Calculator/
├── index.html    # 페이지 마크업
├── styles.css    # 스타일
├── script.js     # 계산 로직
└── README.md
```

## 데이터 정책

의료 데이터(CSV/DICOM 등)는 저장소에 포함하지 않습니다 (`.gitignore`로 차단).
