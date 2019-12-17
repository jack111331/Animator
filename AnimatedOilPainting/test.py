from PIL import Image

def get_intensity(color, intensity_level):
    intensity = int((color[0] + color[1] + color[2]) / 3 * intensity_level / 255)
    current_intensity = min(intensity, 255) 
    return current_intensity

def calculate_color(color_grid, width, height, radius, intensity_level, x, y):
    start_x = max(x-radius, 0)
    end_x = min(x+radius + 1, width)
    start_y = max(y-radius, 0)
    end_y = min(y+radius + 1, height)
    intensity_statistic = [0]*256
    for i in range(start_x, end_x):
        print(len(pixels[i]))
        for j in range(start_y, end_y):
            intensity = get_intensity(color_grid[i][j], intensity_level)
            intensity_statistic[intensity] = intensity_statistic[intensity] + 1
            
    max_intensity = 0
    for i in range(256):
        if intensity_statistic[max_intensity] < intensity_statistic[i]:
            max_intensity = max(max_intensity, i)
        
    final_color = [0, 0, 0]
    for i in range(start_x, end_x):
        for j in range(start_y, end_y):
            if get_intensity(color_grid[i][j], intensity_level) == max_intensity:
                final_color[0] += color_grid[i][j][0]
                final_color[1] += color_grid[i][j][1]
                final_color[2] += color_grid[i][j][2]
    
    final_color[0] //= intensity_statistic[max_intensity]
    final_color[1] //= intensity_statistic[max_intensity]
    final_color[2] //= intensity_statistic[max_intensity]
    return (final_color[0], final_color[1], final_color[2])


image = Image.open(r"image.jpg")
width, height = image.size
pixels = []

for i in range(0, width):
    pixel_row = []
    for j in range(0, height):
        pixel_value = image.getpixel((i, j))
        pixel_row.append(pixel_value)
    pixels.append(pixel_row)


for i in range(0, width):
    for j in range(0, height):
        print(i, j)
        image.putpixel((i, j), calculate_color(pixels, width, height, 4, 5, i, j))
        
image.show()
