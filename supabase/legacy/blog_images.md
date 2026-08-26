# Blog images — single download manifest

Every image used by the seeded Hub stories, in one place. The **cover** is the
featured image (stored on `blogs.cover_image_url`); **gallery** images are the
extra in-article photos (stored on `blogs.gallery`, applied by
`010_blog_gallery.sql`). None of these URLs are embedded inside the story body —
they are kept as data and rendered on the blog after the text.

Source: fetched from the live articles on whrdhub.org.

## By story

### Rasna Warah (`rasna-warah`)
- cover: https://whrdhub.org/wp-content/uploads/2025/04/Rasna-Warah.jpg

### International Women's Day 2025 (`international-womens-day-2025`)
- cover: https://whrdhub.org/wp-content/uploads/2025/03/IMG_0764-scaled.jpg
- gallery: https://whrdhub.org/wp-content/uploads/2025/03/IMG_0902-scaled.jpg

### The Hub's First Donor Roundtable (`first-donor-roundtable`)
- cover: https://whrdhub.org/wp-content/uploads/2024/09/0I2A7208-scaled.jpg

### Safety and Security Training Program (`safety-and-security-training-program`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.39.20.jpeg

### WHRDHUB Strategic Plan 2024-2028 Validation (`strategic-plan-2024-2028-validation`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg

### Convening Protection Networks (`protection-networks-consortium-convening`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.27.40-1.jpeg

### Meeting with Delegates from the French Embassy (`meeting-with-delegates-french-embassy`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.26.32.jpeg

### Joannah Stutchbury (`joannah-stutchbury`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2021-08-02-at-02.03.06.jpeg

### Elizabeth Ekaru (`elizabeth-ekaru`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/download-3.jpg

### IWHRD Celebrations 2023 (`iwhrd-celebrations-2023`)
- cover: https://whrdhub.org/wp-content/uploads/2024/05/Capture.png

## Plain list (one URL per line — feed straight into a downloader)

```
https://whrdhub.org/wp-content/uploads/2025/04/Rasna-Warah.jpg
https://whrdhub.org/wp-content/uploads/2025/03/IMG_0764-scaled.jpg
https://whrdhub.org/wp-content/uploads/2025/03/IMG_0902-scaled.jpg
https://whrdhub.org/wp-content/uploads/2024/09/0I2A7208-scaled.jpg
https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.39.20.jpeg
https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg
https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.27.40-1.jpeg
https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.26.32.jpeg
https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2021-08-02-at-02.03.06.jpeg
https://whrdhub.org/wp-content/uploads/2024/05/download-3.jpg
https://whrdhub.org/wp-content/uploads/2024/05/Capture.png
```

To download them all at once, save the block above as `urls.txt` and run:
`wget -i urls.txt` (or `xargs -n1 curl -O < urls.txt`).
